import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Calendar, Clock, Users } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

import {
  Professor,
  Subject,
  Room,
  Section,
} from "@/types/scheduling";
import RoomSelectors from "./RoomSelectors";
import { useRoomOptions } from "./useRoomOptions";

const scheduleFormSchema = z
  .object({
    schoolYear: z.string().min(9).max(9).regex(/^\d{4}-\d{4}$/),
    semester: z.string().min(1),
    level: z.enum(["11", "12"]),
    // make strand optional so validation never blocks submit
    strand: z.string().optional(),
    subjectId: z.string().min(1),
    scheduleType: z.enum(["Onsite", "Online"]),
    days: z.array(z.string()).min(1).max(6),
    startTime: z
      .string()
      .min(1)
      .refine((t) => {
        const h = parseInt(t.split(":")[0], 10);
        return h >= 8 && h <= 17;
      }, "Start time must be between 8:00 AM and 5:00 PM"),
    endTime: z
      .string()
      .min(1)
      .refine((t) => {
        const h = parseInt(t.split(":")[0], 10);
        return h >= 9 && h <= 18;
      }, "End time must be between 9:00 AM and 6:00 PM"),
    room: z.string().optional(),
    roomType: z.enum(["Lecture", "Laboratory"]).optional(),
    professorId: z.string().min(1),
    section: z.string().min(1),
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
    { message: "End time must be after start time", path: ["endTime"] }
  )
  .refine((data) => (data.scheduleType === "Onsite" ? !!data.room : true), {
    message: "Room is required for onsite schedules",
    path: ["room"],
  });

const daysOfWeek = [
  { id: "monday", label: "Monday" },
  { id: "tuesday", label: "Tuesday" },
  { id: "wednesday", label: "Wednesday" },
  { id: "thursday", label: "Thursday" },
  { id: "friday", label: "Friday" },
  { id: "saturday", label: "Saturday" },
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
  const { settings } = useSystemSettings();

  const [professors, setProfessors] = useState<Professor[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState({
    professors: false,
    subjects: false,
    rooms: false,
    sections: false,
    submission: false,
  });

  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const form = useForm<z.infer<typeof scheduleFormSchema>>({
    resolver: zodResolver(scheduleFormSchema),
    mode: "onSubmit",
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

  // keep year/semester in sync with global settings
  useEffect(() => {
    form.setValue("schoolYear", settings.schoolYear);
    form.setValue("semester", settings.semester);
  }, [settings, form]);

  const watched = form.watch();
  const isOnsite = watched.scheduleType === "Onsite";

  const clearRoomCb = useCallback(() => {
    const current = form.getValues("room");
    if (current) form.setValue("room", undefined);
  }, [form]);

  const getRoomIdCb = useCallback(() => form.getValues("room"), [form]);

  const { availableRooms: availableRoomsForType, selectedSection } = useRoomOptions({
    scheduleType: watched.scheduleType as "Onsite" | "Online",
    roomType: (watched.roomType || "Lecture") as "Lecture" | "Laboratory",
    sectionId: watched.section,
    sections,
    rooms,
    clearRoom: clearRoomCb,
    getSelectedRoomId: getRoomIdCb,
  });

  // hydrate level/strand from selected section so validation never fails
  useEffect(() => {
    if (selectedSection) {
      form.setValue("level", selectedSection.grade_level as "11" | "12");
      form.setValue("strand", selectedSection.strand ?? "");
    }
  }, [selectedSection, form]);

  // auto-assign lecture room if the section has one
  useEffect(() => {
    if (!isOnsite) return;

    const rt = (watched.roomType || "Lecture") as "Lecture" | "Laboratory";
    if (rt === "Lecture") {
      const assigned = selectedSection?.rooms?.filter((r) => r.type === "Lecture") ?? [];
      if (assigned.length > 0) {
        const firstId = assigned[0].id;
        if (form.getValues("room") !== firstId) form.setValue("room", firstId);
      } else if (form.getValues("room")) {
        form.setValue("room", undefined);
      }
    } else {
      const current = form.getValues("room");
      const stillValid = (availableRoomsForType ?? []).some((r) => r.id === current);
      if (current && !stillValid) form.setValue("room", undefined);
    }
  }, [isOnsite, watched.roomType, watched.section, selectedSection, availableRoomsForType, form]);

  useEffect(() => {
    (async () => {
      await Promise.all([fetchProfessors(), fetchSubjects(), fetchRooms(), fetchSections()]);
    })();
  }, []);

  const fetchProfessors = async () => {
    setLoading((p) => ({ ...p, professors: true }));
    try {
      const res = await apiService.getProfessors();
      console.log("👩‍🏫 Professors fetched:", res);
      if (res.success && Array.isArray(res.data)) {
        setProfessors(
          res.data
            .filter((p: any) => p && (p.prof_id || p.id))
            .map((p: any) => ({
              id: (p.prof_id || p.id).toString(),
              name: p.prof_name || p.name || "Unknown Professor",
              subjectCount: parseInt(p.subject_count || p.subjectCount || "0"),
            }))
        );
      }
    } finally {
      setLoading((p) => ({ ...p, professors: false }));
    }
  };

  const fetchSubjects = async () => {
    setLoading((p) => ({ ...p, subjects: true }));
    try {
      const res = await apiService.getSubjects();
      console.log("📚 Subjects fetched:", res);
      if (res.success && Array.isArray(res.data)) {
        setSubjects(
          res.data
            .filter((s: any) => s && (s.subj_id || s.id))
            .map((s: any) => ({
              id: (s.subj_id || s.id).toString(),
              code: s.subj_code || s.code || "No Code",
              name: s.subj_name || s.name || "No Name",
            }))
        );
      }
    } finally {
      setLoading((p) => ({ ...p, subjects: false }));
    }
  };

  const fetchRooms = async () => {
    setLoading((p) => ({ ...p, rooms: true }));
    try {
      const res = await apiService.getRooms();
      console.log("🚪 Rooms fetched:", res);
      if (res.success && Array.isArray(res.data)) {
        setRooms(
          res.data
            .filter((r: any) => r && (r.room_id || r.id))
            .map((r: any) => ({
              id: (r.room_id || r.id).toString(),
              number: (r.room_number || r.number).toString(),
              type: (r.room_type || r.type || "Lecture") as "Lecture" | "Laboratory",
              capacity: parseInt(r.room_capacity || r.capacity || "0"),
            }))
        );
      }
    } finally {
      setLoading((p) => ({ ...p, rooms: false }));
    }
  };

  const fetchSections = async () => {
    setLoading((p) => ({ ...p, sections: true }));
    try {
      const res = await apiService.getSections();
      console.log("📦 Sections fetched:", res);
      if (res.success && Array.isArray(res.data)) {
        setSections(
          res.data.map((section: any) => ({
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
          }))
        );
      }
    } finally {
      setLoading((p) => ({ ...p, sections: false }));
    }
  };

  const selectedProfessor = useMemo(
    () => professors.find((p) => p.id === watched.professorId),
    [professors, watched.professorId]
  );

  const onValid = async (values: z.infer<typeof scheduleFormSchema>) => {
    const payload = {
      school_year: values.schoolYear,
      semester: values.semester,
      subj_id: parseInt(values.subjectId),
      prof_id: parseInt(values.professorId),
      schedule_type: values.scheduleType,
      start_time: values.startTime,
      end_time: values.endTime,
      room_id: values.room ? parseInt(values.room) : undefined,
      section_id: parseInt(values.section),
      days: values.days, // saved as JSON in DB
    };

    console.log("🟢 Submitting schedule payload:", payload);

    setLoading((p) => ({ ...p, submission: true }));
    try {
      const response = await apiService.createSchedule(payload as any);
      console.log("🟢 Create schedule response:", response);

      if (response.success) {
        setShowSuccess(true);
        await fetchProfessors();
        onSubmit?.(values);
        form.reset({
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
        });
      } else {
        setErrorMessage(response.message || "Failed to create schedule");
        setShowError(true);
      }
    } catch (err) {
      console.error("🔴 Submit error:", err);
      setErrorMessage("Unable to create schedule. Please check your connection and try again.");
      setShowError(true);
    } finally {
      setLoading((p) => ({ ...p, submission: false }));
    }
  };

  const onInvalid = (errors: any) => {
    console.warn("🟠 Form validation failed:", errors);
    setErrorMessage("Please fill all required fields correctly.");
    setShowError(true);
  };

  const selectTimeSlot = (startTime: string, endTime: string) => {
    form.setValue("startTime", startTime);
    form.setValue("endTime", endTime);
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
              Fill in the details to create a new class schedule.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 pb-6">
            <Form {...form}>
              <form id="schedule-form" onSubmit={form.handleSubmit(onValid, onInvalid)} className="space-y-6">
                <div className="grid grid-cols-2 gap-4 p-4 bg-blue-50 rounded-lg">
                  <FormField
                    control={form.control}
                    name="schoolYear"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>School Year</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. 2024-2025" {...field} className="bg-white" readOnly />
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
                        <Select onValueChange={field.onChange} defaultValue={field.value} disabled>
                          <FormControl>
                            <SelectTrigger className="bg-white">
                              <SelectValue placeholder="Select semester" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="First Semester">First Semester</SelectItem>
                            <SelectItem value="Second Semester">Second Semester</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="section"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Section
                      </FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            {loading.sections ? <span>Loading sections...</span> : <SelectValue placeholder="Select a section" />}
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {sections.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name} - Grade {s.grade_level} {s.strand}
                              <Badge variant="outline" className="ml-2">
                                {s.number_of_students} students
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
                  name="subjectId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subject</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            {loading.subjects ? <span>Loading subjects...</span> : <SelectValue placeholder="Select a subject" />}
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {subjects.map((subj) => (
                            <SelectItem key={subj.id} value={subj.id}>
                              {subj.code} - {subj.name}
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
                  name="scheduleType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Schedule Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                                        ? field.onChange([...(field.value ?? []), day.id])
                                        : field.onChange((field.value ?? []).filter((v: string) => v !== day.id))
                                    }
                                  />
                                </FormControl>
                                <FormLabel className="font-normal cursor-pointer">{day.label}</FormLabel>
                              </FormItem>
                            )}
                          />
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

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

                <RoomSelectors
                  control={form.control}
                  isOnsite={isOnsite}
                  loadingRooms={loading.rooms}
                  roomTypeValue={(watched.roomType || "Lecture") as "Lecture" | "Laboratory"}
                  availableRooms={availableRoomsForType}
                  selectedSection={selectedSection}
                  onRoomTypeChange={(v) => {
                    form.setValue("roomType", v);
                    form.setValue("room", undefined);
                  }}
                />

                <FormField
                  control={form.control}
                  name="professorId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Professor</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            {loading.professors ? <span>Loading professors...</span> : <SelectValue placeholder="Select a professor" />}
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {professors.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}
                              <Badge variant="secondary" className="ml-2">
                                {p.subjectCount} subjects
                              </Badge>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </form>
            </Form>
          </div>

          <DialogFooter className="px-6 pb-6 pt-2 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange?.(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="schedule-form"
              disabled={loading.submission || (selectedProfessor?.subjectCount ?? 0) >= 8}
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

      <Dialog open={showSuccess} onOpenChange={setShowSuccess}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-green-600">Success!</DialogTitle>
            <DialogDescription>
              Schedule created successfully! The new class has been added to the system.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setShowSuccess(false)}>OK</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showError} onOpenChange={setShowError}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600">Create Schedule</DialogTitle>
            <DialogDescription className="text-base">{errorMessage}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              onClick={() => {
                setShowError(false);
              }}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ScheduleForm;
