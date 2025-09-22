import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  AlertTriangle,
  Calendar,
  Clock,
  Users,
  MapPin,
  CheckCircle,
} from "lucide-react";
import { apiService } from "@/services/apiService";
import { useSystemSettings } from "@/contexts/SystemSettingsContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

// Types
interface Professor {
  id: string;
  name: string;
  subjectCount: number;
}

interface Subject {
  id: string;
  code: string;
  name: string;
}

interface Room {
  id: string;
  number: string;
  type: "Lecture" | "Laboratory";
  capacity: number;
}

interface Section {
  id: string;
  name: string;
  grade_level: "11" | "12";
  strand: string;
  number_of_students: number;
  rooms: Room[];
}

interface TimeSlot {
  start_time: string;
  end_time: string;
  display: string;
}

interface ConflictInfo {
  type: "professor" | "room" | "section";
  message: string;
  conflictingDays: string[];
}

// Form Schema
const scheduleFormSchema = z
  .object({
    schoolYear: z
      .string()
      .min(9, "School year must be in format YYYY-YYYY")
      .max(9, "School year must be in format YYYY-YYYY")
      .regex(/^\d{4}-\d{4}$/, "School year must be in format YYYY-YYYY"),

    semester: z.string().min(1, "Please select a semester"),

    level: z.enum(["11", "12"], {
      required_error: "Please select a level",
    }),

    strand: z.string().min(1, "Please select a strand"),

    subjectId: z.string().min(1, "Please select a subject"),

    scheduleType: z.enum(["Onsite", "Online"], {
      required_error: "Please select a schedule type",
    }),

    days: z
      .array(z.string())
      .min(1, "Select at least one day")
      .max(6, "Maximum 6 days allowed"),

    startTime: z
      .string()
      .min(1, "Please select a start time")
      .refine((time) => {
        const [hours] = time.split(":");
        const hour = parseInt(hours, 10);
        return hour >= 8 && hour <= 17;
      }, "Start time must be between 8:00 AM and 5:00 PM"),

    endTime: z
      .string()
      .min(1, "Please select an end time")
      .refine((time) => {
        const [hours] = time.split(":");
        const hour = parseInt(hours, 10);
        return hour >= 9 && hour <= 18;
      }, "End time must be between 9:00 AM and 6:00 PM"),

    room: z.string().optional(),
    roomType: z.enum(["Lecture", "Laboratory"]).optional(),

    professorId: z.string().min(1, "Please select a professor"),
    section: z.string().min(1, "Please select a section"),
  })
  .refine(
    (data) => {
      if (data.startTime && data.endTime) {
        const start = new Date(`2000-01-01T${data.startTime}`);
        const end = new Date(`2000-01-01T${data.endTime}`);
        return end > start;
      }
      return true;
    },
    {
      message: "End time must be after start time",
      path: ["endTime"],
    }
  )
  .refine(
    (data) => {
      if (data.scheduleType === "Onsite") {
        return !!data.room;
      }
      return true;
    },
    {
      message: "Room is required for onsite schedules",
      path: ["room"],
    }
  );

const daysOfWeek = [
  { id: "monday", label: "Monday", short: "Mon" },
  { id: "tuesday", label: "Tuesday", short: "Tue" },
  { id: "wednesday", label: "Wednesday", short: "Wed" },
  { id: "thursday", label: "Thursday", short: "Thu" },
  { id: "friday", label: "Friday", short: "Fri" },
  { id: "saturday", label: "Saturday", short: "Sat" },
];

interface ScheduleFormProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSubmit?: (values: z.infer<typeof scheduleFormSchema>) => void;
}

const ScheduleForm: React.FC<ScheduleFormProps> = ({
  open = true,
  onOpenChange,
  onSubmit,
}) => {
  // System settings
  const { settings } = useSystemSettings();

  // State
  const [professors, setProfessors] = useState<Professor[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);

  // Loading states
  const [loading, setLoading] = useState({
    professors: false,
    subjects: false,
    rooms: false,
    sections: false,
    submission: false,
    conflictCheck: false,
  });

  // Conflict detection states
  const [availableSlots, setAvailableSlots] = useState<
    Record<string, TimeSlot[]>
  >({});
  const [conflicts, setConflicts] = useState<ConflictInfo[]>([]);
  const [showAvailableSlots, setShowAvailableSlots] = useState(false);
  const [isCheckingConflicts, setIsCheckingConflicts] = useState(false);

  // Success/Error states
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [recommendations, setRecommendations] = useState<string[]>([]);

  // Form setup
  const form = useForm<z.infer<typeof scheduleFormSchema>>({
    resolver: zodResolver(scheduleFormSchema),
    defaultValues: {
      schoolYear: settings.schoolYear,
      semester: settings.semester,
      level: "11",
      strand: "",
      subjectId: "",
      scheduleType: "Onsite",
      days: [],
      startTime: "",
      endTime: "",
      room: undefined,
      roomType: "Lecture",
      professorId: "",
      section: "",
    },
  });

  // Watch form values for real-time validation
  const watchedValues = form.watch();
  const selectedSection = sections.find((s) => s.id === watchedValues.section);
  const selectedProfessor = professors.find(
    (p) => p.id === watchedValues.professorId
  );
  const isOnsiteSchedule = watchedValues.scheduleType === "Onsite";

  // Update form when system settings change
  useEffect(() => {
    form.setValue("schoolYear", settings.schoolYear);
    form.setValue("semester", settings.semester);
  }, [settings, form]);

  // Auto-populate level and strand when section changes
  useEffect(() => {
    if (selectedSection) {
      form.setValue("level", selectedSection.grade_level);
      form.setValue("strand", selectedSection.strand);

      // Auto-select room if section has assigned rooms
      if (selectedSection.rooms && selectedSection.rooms.length > 0) {
        const assignedRoom = selectedSection.rooms[0];
        form.setValue("room", assignedRoom.id);
        form.setValue("roomType", assignedRoom.type);
        setAvailableRooms(selectedSection.rooms);
      } else {
        form.setValue("room", undefined);
        setAvailableRooms(rooms);
      }
    }
  }, [selectedSection, rooms, form]);

  // Real-time conflict detection
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (
        watchedValues.days?.length > 0 &&
        watchedValues.startTime &&
        watchedValues.endTime &&
        watchedValues.professorId &&
        watchedValues.section
      ) {
        checkConflictsRealTime();
      } else {
        setConflicts([]);
        setAvailableSlots({});
        setShowAvailableSlots(false);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [
    watchedValues.days,
    watchedValues.startTime,
    watchedValues.endTime,
    watchedValues.professorId,
    watchedValues.section,
    watchedValues.room,
    watchedValues.schoolYear,
    watchedValues.semester,
  ]);

  // Conflict detection function
  const checkConflictsRealTime = async () => {
    setIsCheckingConflicts(true);
    setConflicts([]);

    try {
      const detectedConflicts: ConflictInfo[] = [];

      // Check all conflicts at once
      const conflictResult = await checkAllConflicts(watchedValues);
      if (conflictResult && conflictResult.conflicts) {
        detectedConflicts.push(...conflictResult.conflicts);
      }

      // Get available time slots
      const slotsResult = await getAvailableTimeSlots(watchedValues);
      if (slotsResult && slotsResult.availableSlots) {
        setAvailableSlots(slotsResult.availableSlots);
        setShowAvailableSlots(true);
      }

      setConflicts(detectedConflicts);
    } catch (error) {
      console.error("Error checking conflicts:", error);
    } finally {
      setIsCheckingConflicts(false);
    }
  };

  // Check all conflicts using enhanced conflict checker
  const checkAllConflicts = async (formData: any) => {
    try {
      const response = await apiService.makeRequest(
        "POST",
        "/enhanced_conflict_detection.php",
        {
          type: "all",
          school_year: formData.schoolYear,
          semester: formData.semester,
          prof_id: formData.professorId ? parseInt(formData.professorId) : null,
          room_id: formData.room ? parseInt(formData.room) : null,
          section_id: formData.section ? parseInt(formData.section) : null,
          days: formData.days,
          start_time: formData.startTime,
          end_time: formData.endTime,
        }
      );

      if (response.success && (response as any).hasConflicts) {
        const responseData = response as any;
        const conflicts = responseData.conflicts.map((conflict: any) => ({
          type: conflict.type,
          message: conflict.message,
          conflictingDays: responseData.conflictingDays || [],
        }));
        return { conflicts };
      }
    } catch (error) {
      console.error("Error checking conflicts:", error);
    }
    return { conflicts: [] };
  };

  // Get available time slots
  const getAvailableTimeSlots = async (formData: any) => {
    try {
      const response = await apiService.makeRequest(
        "POST",
        "/get_available_time_slots.php",
        {
          school_year: formData.schoolYear,
          semester: formData.semester,
          days: formData.days,
          prof_id: formData.professorId ? parseInt(formData.professorId) : null,
          room_id: formData.room ? parseInt(formData.room) : null,
          section_id: formData.section ? parseInt(formData.section) : null,
        }
      );

      if (response.success) {
        return {
          availableSlots: (response as any).available_slots || {},
          conflicts: [],
        };
      }
    } catch (error) {
      console.error("Error getting available slots:", error);
    }
    return { availableSlots: {}, conflicts: [] };
  };

  // Validate selected time slot against available slots
  const validateSelectedTimeSlot = (formData: any): boolean => {
    if (!availableSlots || Object.keys(availableSlots).length === 0) {
      return true; // If no available slots data, allow submission
    }

    const selectedSlot = `${formData.startTime}-${formData.endTime}`;

    // Check if the selected time slot is available on ALL selected days
    return formData.days.every((day: string) => {
      const daySlots = availableSlots[day.toLowerCase()];
      return (
        Array.isArray(daySlots) &&
        daySlots.some(
          (slot) => `${slot.start_time}-${slot.end_time}` === selectedSlot
        )
      );
    });
  };

  // Generate recommendations for alternative time slots
  const generateRecommendations = async (
    values: z.infer<typeof scheduleFormSchema>
  ) => {
    const recommendations: string[] = [];

    try {
      // Get available slots for the same days
      const response = await apiService.getAvailableTimeSlots({
        section_id: parseInt(values.section),
        days: values.days,
        school_year: values.schoolYear,
        semester: values.semester,
      });

      if (response.success && response.data) {
        // Find alternative time slots
        Object.entries(response.data).forEach(([day, slots]) => {
          if (Array.isArray(slots) && slots.length > 0) {
            const availableSlots = slots.slice(0, 3); // Show top 3 alternatives
            availableSlots.forEach((slot) => {
              const startTime = new Date(`2000-01-01T${slot.start_time}`);
              const endTime = new Date(`2000-01-01T${slot.end_time}`);
              const formatTime = (time: Date) => {
                const hours = time.getHours();
                const minutes = time.getMinutes();
                return `${hours % 12 || 12}:${minutes
                  .toString()
                  .padStart(2, "0")} ${hours >= 12 ? "PM" : "AM"}`;
              };

              recommendations.push(
                `${day.charAt(0).toUpperCase() + day.slice(1)}: ${formatTime(
                  startTime
                )} - ${formatTime(endTime)}`
              );
            });
          }
        });
      }

      // If no alternatives found, suggest different days
      if (recommendations.length === 0) {
        const allDays = [
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
        ];
        const unselectedDays = allDays.filter(
          (day) => !values.days.includes(day.toLowerCase())
        );

        unselectedDays.slice(0, 3).forEach((day) => {
          recommendations.push(`Try ${day} instead`);
        });
      }
    } catch (error) {
      console.error("Error generating recommendations:", error);
      recommendations.push("Try a different time slot");
      recommendations.push("Try different days of the week");
      recommendations.push("Consider online delivery mode");
    }

    return recommendations.length > 0
      ? recommendations
      : [
          "Try selecting different time slots",
          "Consider changing to a different day",
          "Check if online mode is available",
        ];
  };

  // Form submission
  const handleSubmit = async (values: z.infer<typeof scheduleFormSchema>) => {
    setLoading((prev) => ({ ...prev, submission: true }));

    try {
      // Simplified validation - let the backend handle most conflict checking
      // Only check for professor workload limit
      if (selectedProfessor && selectedProfessor.subjectCount >= 8) {
        setErrorMessage(
          "This professor has reached the maximum workload limit. Please select a different professor."
        );
        setShowError(true);
        return;
      }

      // Create schedule
      const scheduleData = {
        school_year: values.schoolYear,
        semester: values.semester,
        subj_id: parseInt(values.subjectId),
        prof_id: parseInt(values.professorId),
        schedule_type: values.scheduleType,
        start_time: values.startTime,
        end_time: values.endTime,
        room_id: values.room ? parseInt(values.room) : undefined,
        section_id: parseInt(values.section),
        days: values.days,
      };

      console.log("🚀 Submitting schedule data:", scheduleData);
      const response = await apiService.createSchedule(scheduleData);
      console.log("📝 Backend response:", response);
      console.log("📝 Response success:", response.success);
      console.log("📝 Response message:", response.message);

      if (response.success) {
        setShowSuccess(true);
        // Refresh professor data to update subject count
        await fetchProfessors();
        if (onSubmit) onSubmit(values);
        form.reset();
      } else {
        // Handle different types of errors with user-friendly messages
        const errorMsg = response.message || "Failed to create schedule";

        if (
          errorMsg.toLowerCase().includes("conflict") ||
          errorMsg.toLowerCase().includes("already has this subject") ||
          errorMsg.toLowerCase().includes("database error")
        ) {
          // Generate recommendations for conflict resolution
          const recs = await generateRecommendations(values);
          setRecommendations(recs);
          setErrorMessage(
            "Schedule conflict detected! This time slot is already taken. Please try one of the suggested alternatives below:"
          );
        } else {
          setErrorMessage(errorMsg);
          setRecommendations([]);
        }
        setShowError(true);
      }
    } catch (error) {
      setErrorMessage(
        "Unable to create schedule. Please check your connection and try again."
      );
      setRecommendations([]);
      setShowError(true);
    } finally {
      setLoading((prev) => ({ ...prev, submission: false }));
    }
  };

  // Select time slot from available slots
  const selectTimeSlot = (startTime: string, endTime: string) => {
    form.setValue("startTime", startTime);
    form.setValue("endTime", endTime);
  };

  // Data fetching functions
  useEffect(() => {
    const fetchData = async () => {
      const fetchPromises = [
        fetchProfessors(),
        fetchSubjects(),
        fetchRooms(),
        fetchSections(),
      ];

      await Promise.all(fetchPromises);
    };

    fetchData();
  }, []);

  const fetchProfessors = async () => {
    setLoading((prev) => ({ ...prev, professors: true }));
    try {
      const response = await apiService.getProfessors();
      if (response.success && Array.isArray(response.data)) {
        const mappedProfessors = response.data
          .filter((prof: any) => prof && (prof.prof_id || prof.id))
          .map((prof: any) => ({
            id: (prof.prof_id || prof.id).toString(),
            name: prof.prof_name || prof.name || "Unknown Professor",
            subjectCount: parseInt(
              prof.subject_count || prof.subjectCount || "0"
            ),
          }));
        setProfessors(mappedProfessors);
      }
    } catch (error) {
      console.error("Error fetching professors:", error);
    } finally {
      setLoading((prev) => ({ ...prev, professors: false }));
    }
  };

  const fetchSubjects = async () => {
    setLoading((prev) => ({ ...prev, subjects: true }));
    try {
      const response = await apiService.getSubjects();
      if (response.success && Array.isArray(response.data)) {
        const mappedSubjects = response.data
          .filter((subj: any) => subj && (subj.subj_id || subj.id))
          .map((subj: any) => ({
            id: (subj.subj_id || subj.id).toString(),
            code: subj.subj_code || subj.code || "No Code",
            name: subj.subj_name || subj.name || "No Name",
          }));
        setSubjects(mappedSubjects);
      }
    } catch (error) {
      console.error("Error fetching subjects:", error);
    } finally {
      setLoading((prev) => ({ ...prev, subjects: false }));
    }
  };

  const fetchRooms = async () => {
    setLoading((prev) => ({ ...prev, rooms: true }));
    try {
      const response = await apiService.getRooms();
      if (response.success && Array.isArray(response.data)) {
        const mappedRooms = response.data
          .filter((room: any) => room && (room.room_id || room.id))
          .map((room: any) => ({
            id: (room.room_id || room.id).toString(),
            number: (room.room_number || room.number).toString(),
            type: room.room_type || room.type || "Lecture",
            capacity: parseInt(room.room_capacity || room.capacity || "0"),
          }));
        setRooms(mappedRooms);
        setAvailableRooms(mappedRooms);
      }
    } catch (error) {
      console.error("Error fetching rooms:", error);
    } finally {
      setLoading((prev) => ({ ...prev, rooms: false }));
    }
  };

  const fetchSections = async () => {
    setLoading((prev) => ({ ...prev, sections: true }));
    try {
      const response = await apiService.getSections();
      if (response.success && Array.isArray(response.data)) {
        const mappedSections = response.data.map((section: any) => ({
          id: (section.section_id || section.id).toString(),
          name: section.section_name || section.name || "Unknown Section",
          grade_level: (section.grade_level as "11" | "12") || "11",
          strand: section.strand || "",
          number_of_students: section.number_of_students || 0,
          rooms: Array.isArray(section.rooms)
            ? section.rooms.map((room: any) => ({
                id: room.id?.toString() || "",
                number: room.number?.toString() || "Unknown",
                type: (room.type as "Lecture" | "Laboratory") || "Lecture",
                capacity: parseInt(room.capacity || "0"),
              }))
            : [],
        }));
        setSections(mappedSections);
      }
    } catch (error) {
      console.error("Error fetching sections:", error);
    } finally {
      setLoading((prev) => ({ ...prev, sections: false }));
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] bg-white overflow-hidden flex flex-col">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Create New Schedule
            </DialogTitle>
            <DialogDescription>
              Fill in the details to create a new class schedule. The system
              will automatically detect conflicts and suggest available time
              slots.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 pb-6">
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(handleSubmit)}
                className="space-y-6"
              >
                {/* Academic Period */}
                <div className="grid grid-cols-2 gap-4 p-4 bg-blue-50 rounded-lg">
                  <FormField
                    control={form.control}
                    name="schoolYear"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>School Year</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g. 2024-2025"
                            {...field}
                            className="bg-white"
                            readOnly
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="semester"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Semester</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          disabled
                        >
                          <FormControl>
                            <SelectTrigger className="bg-white">
                              <SelectValue placeholder="Select semester" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="First Semester">
                              First Semester
                            </SelectItem>
                            <SelectItem value="Second Semester">
                              Second Semester
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Section Selection */}
                <FormField
                  control={form.control}
                  name="section"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Section
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            {loading.sections ? (
                              <span>Loading sections...</span>
                            ) : (
                              <SelectValue placeholder="Select a section" />
                            )}
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {sections.map((section) => (
                            <SelectItem key={section.id} value={section.id}>
                              {section.name} - Grade {section.grade_level}{" "}
                              {section.strand}
                              <Badge variant="outline" className="ml-2">
                                {section.number_of_students} students
                              </Badge>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Subject Selection */}
                <FormField
                  control={form.control}
                  name="subjectId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subject</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            {loading.subjects ? (
                              <span>Loading subjects...</span>
                            ) : (
                              <SelectValue placeholder="Select a subject" />
                            )}
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {subjects.map((subject) => (
                            <SelectItem key={subject.id} value={subject.id}>
                              {subject.code} - {subject.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Schedule Type */}
                <FormField
                  control={form.control}
                  name="scheduleType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Schedule Type</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select schedule type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Onsite">Onsite</SelectItem>
                          <SelectItem value="Online">Online</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Days Selection */}
                <FormField
                  control={form.control}
                  name="days"
                  render={() => (
                    <FormItem>
                      <FormLabel>Schedule Days</FormLabel>
                      <div className="grid grid-cols-3 gap-2">
                        {daysOfWeek.map((day) => (
                          <FormField
                            key={day.id}
                            control={form.control}
                            name="days"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(day.id)}
                                    onCheckedChange={(checked) =>
                                      checked
                                        ? field.onChange([
                                            ...field.value,
                                            day.id,
                                          ])
                                        : field.onChange(
                                            field.value?.filter(
                                              (value) => value !== day.id
                                            )
                                          )
                                    }
                                  />
                                </FormControl>
                                <FormLabel className="font-normal cursor-pointer">
                                  {day.label}
                                </FormLabel>
                              </FormItem>
                            )}
                          />
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Time Selection */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="startTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          Start Time
                        </FormLabel>
                        <FormControl>
                          <Input type="time" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="endTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Time</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Room Selection (for onsite schedules) */}
                {isOnsiteSchedule && (
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="room"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            Room
                          </FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                {loading.rooms ? (
                                  <span>Loading rooms...</span>
                                ) : !selectedSection ? (
                                  <span>Select a section first</span>
                                ) : (
                                  <SelectValue placeholder="Select a room" />
                                )}
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {availableRooms.map((room) => (
                                <SelectItem key={room.id} value={room.id}>
                                  Room {room.number} ({room.type})
                                  <Badge variant="outline" className="ml-2">
                                    {room.capacity} capacity
                                  </Badge>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="roomType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Room Type</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            disabled
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select room type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Lecture">
                                Lecture Room
                              </SelectItem>
                              <SelectItem value="Laboratory">
                                Laboratory
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                {/* Professor Selection */}
                <FormField
                  control={form.control}
                  name="professorId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Professor</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            {loading.professors ? (
                              <span>Loading professors...</span>
                            ) : (
                              <SelectValue placeholder="Select a professor" />
                            )}
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {professors.map((professor) => (
                            <SelectItem key={professor.id} value={professor.id}>
                              {professor.name}
                              <Badge
                                variant={
                                  professor.subjectCount >= 8
                                    ? "destructive"
                                    : professor.subjectCount >= 6
                                    ? "outline"
                                    : "secondary"
                                }
                                className="ml-2"
                              >
                                {professor.subjectCount} subjects
                              </Badge>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Professor Workload Warning */}
                {selectedProfessor && selectedProfessor.subjectCount >= 6 && (
                  <Alert
                    variant={
                      selectedProfessor.subjectCount >= 8
                        ? "destructive"
                        : "default"
                    }
                  >
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>
                      {selectedProfessor.subjectCount >= 8
                        ? "Maximum Limit Reached"
                        : "High Workload Warning"}
                    </AlertTitle>
                    <AlertDescription>
                      Professor {selectedProfessor.name} currently has{" "}
                      {selectedProfessor.subjectCount} subjects assigned.
                      {selectedProfessor.subjectCount >= 8
                        ? " This exceeds the recommended maximum. Please select another professor."
                        : " Adding more subjects may lead to excessive workload."}
                    </AlertDescription>
                  </Alert>
                )}

                {/* Conflict Detection Results */}
                {isCheckingConflicts && (
                  <Alert>
                    <Clock className="h-4 w-4 animate-spin" />
                    <AlertTitle>Checking for conflicts...</AlertTitle>
                    <AlertDescription>
                      Please wait while we validate your schedule.
                    </AlertDescription>
                  </Alert>
                )}

                {conflicts.length > 0 && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Schedule Conflicts Detected</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc list-inside space-y-1">
                        {conflicts.map((conflict, index) => (
                          <li key={index}>
                            {conflict.message}
                            {conflict.conflictingDays.length > 0 && (
                              <span className="text-sm">
                                {" "}
                                on {conflict.conflictingDays.join(", ")}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Available Time Slots */}
                {showAvailableSlots &&
                  Object.keys(availableSlots).length > 0 && (
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <h4 className="font-medium text-blue-800 mb-3">
                        Available Time Slots
                      </h4>
                      <div className="space-y-3">
                        {Object.entries(availableSlots).map(([day, slots]) => (
                          <div key={day}>
                            <h5 className="font-medium capitalize text-sm text-blue-700 mb-2">
                              {day}
                            </h5>
                            <div className="grid grid-cols-3 gap-2">
                              {slots.map((slot, index) => (
                                <Button
                                  key={index}
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    selectTimeSlot(
                                      slot.start_time,
                                      slot.end_time
                                    )
                                  }
                                  className="text-xs"
                                >
                                  {slot.display}
                                </Button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
              </form>
            </Form>
          </div>

          <DialogFooter className="px-6 pb-6 pt-2 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange?.(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                loading.submission ||
                (selectedProfessor?.subjectCount ?? 0) >= 8
              }
              onClick={form.handleSubmit(handleSubmit)}
            >
              {loading.submission ? (
                <span className="flex items-center">
                  <Clock className="animate-spin -ml-1 mr-2 h-4 w-4" />
                  Creating...
                </span>
              ) : (
                "Create Schedule"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success Dialog */}
      <Dialog open={showSuccess} onOpenChange={setShowSuccess}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-green-600">Success!</DialogTitle>
            <DialogDescription>
              Schedule created successfully! The new class has been added to the
              system.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setShowSuccess(false)}>OK</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Error Dialog */}
      <Dialog open={showError} onOpenChange={setShowError}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Schedule Conflict
            </DialogTitle>
            <DialogDescription className="text-base">
              {errorMessage}
            </DialogDescription>
          </DialogHeader>

          {recommendations.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-medium text-sm">Suggested alternatives:</h4>
              <div className="space-y-2">
                {recommendations.map((rec, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg"
                  >
                    <CheckCircle className="h-4 w-4 text-blue-600 flex-shrink-0" />
                    <span className="text-sm text-blue-800">{rec}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              onClick={() => {
                setShowError(false);
                setRecommendations([]);
              }}
            >
              Try Again
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ScheduleForm;
