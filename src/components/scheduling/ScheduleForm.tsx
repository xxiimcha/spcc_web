import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Calendar,
  Clock,
  Users,
  AlertTriangle,
  Lightbulb,
  BookOpen,
  Filter,
  ArrowLeft,
} from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { apiService } from "@/services/apiService";
import { useSystemSettings } from "@/contexts/SystemSettingsContext";
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
import { Professor, Subject, Room, Section } from "@/types/scheduling";
import RoomSelectors from "./RoomSelectors";
import { useRoomOptions } from "./useRoomOptions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const SCHOOL_START = "07:30";
const SCHOOL_END = "16:30";
const LUNCH_START = "12:00";
const LUNCH_END = "13:00";
const SUGGESTION_COUNT = 5;

const scheduleFormSchema = z
  .object({
    schoolYear: z.string().min(9).max(9).regex(/^\d{4}-\d{4}$/),
    semester: z.string().min(1),
    level: z.enum(["11", "12"]),
    strand: z.string().optional(),
    subjectId: z.string().min(1),
    scheduleType: z.enum(["Onsite", "Online"]),
    days: z.array(z.string()).min(1).max(6),
    startTime: z
      .string()
      .min(1)
      .refine(
        (t) => withinWindow(t, SCHOOL_START, SCHOOL_END),
        `Start time must be between ${SCHOOL_START} and ${SCHOOL_END}`
      ),
    endTime: z
      .string()
      .min(1)
      .refine(
        (t) => withinWindow(t, SCHOOL_START, SCHOOL_END),
        `End time must be between ${SCHOOL_START} and ${SCHOOL_END}`
      ),
    room: z.string().optional(),
    roomType: z.enum(["Lecture", "Laboratory"]).optional(),
    professorId: z.string().min(1),
    section: z.string().min(1),
  })
  .refine(
    (data) => {
      if (data.startTime && data.endTime) {
        return toMin(data.endTime) > toMin(data.startTime);
      }
      return true;
    },
    { message: "End time must be after start time", path: ["endTime"] }
  )
  .refine((data) => (data.scheduleType === "Onsite" ? !!data.room : true), {
    message: "Room is required for onsite schedules",
    path: ["room"],
  })
  // 🚫 Block lunch overlap for face-to-face classes
  .refine(
    (data) => {
      if (data.scheduleType !== "Onsite") return true;
      if (!data.startTime || !data.endTime) return true;
      const s = toMin(data.startTime);
      const e = toMin(data.endTime);
      const ls = toMin(LUNCH_START);
      const le = toMin(LUNCH_END);
      return !overlaps(s, e, ls, le);
    },
    {
      message: "Onsite classes cannot be scheduled across 12:00–1:00 PM (lunch break).",
      path: ["startTime"],
    }
  );

const daysOfWeek = [
  { id: "monday", label: "Monday" },
  { id: "tuesday", label: "Tuesday" },
  { id: "wednesday", label: "Wednesday" },
  { id: "thursday", label: "Thursday" },
  { id: "friday", label: "Friday" },
  { id: "saturday", label: "Saturday" },
];

type NormSchedule = {
  id: string;
  subj_id: string;
  prof_id: string;
  section_id: string;
  start: number;
  end: number;
  days: string[];
};

function toMin(hhmm: string) {
  const [h, m] = hhmm.split(":").map((n) => parseInt(n, 10));
  return h * 60 + m;
}
function fromMin(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && bStart < aEnd;
}
function withinWindow(t: string, start: string, end: string) {
  const tm = toMin(t);
  return tm >= toMin(start) && tm <= toMin(end);
}
function normalizeDays(d: any): string[] {
  if (Array.isArray(d)) return d.map((x) => String(x).toLowerCase());
  if (typeof d === "string") return d.split(",").map((x) => x.trim().toLowerCase());
  return [];
}
function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function cryptoId() {
  return Math.random().toString(36).slice(2);
}
function formatDaysShort(days: string[]) {
  return days.map((d) => d.slice(0, 3)).join(" • ");
}
function formatTime12h(hhmm: string) {
  const [h, m] = hhmm.split(":").map((n) => parseInt(n, 10));
  const ampm = h >= 12 ? "PM" : "AM";
  const hh = h % 12 || 12;
  return `${String(hh)}:${String(m).padStart(2, "0")} ${ampm}`;
}

interface ScheduleFormProps {
  onSubmit?: (values: z.infer<typeof scheduleFormSchema>) => void;
  onCancel?: () => void;
  title?: string;
}

type SidebarScope = "all" | "section" | "professor";

const ScheduleForm: React.FC<ScheduleFormProps> = ({
  onSubmit,
  onCancel,
  title = "Create New Schedule",
}) => {
  const { settings } = useSystemSettings();
  const navigate = useNavigate();

  const [professors, setProfessors] = useState<Professor[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [allSchedules, setAllSchedules] = useState<NormSchedule[]>([]);

  const [loading, setLoading] = useState({
    professors: false,
    subjects: false,
    rooms: false,
    sections: false,
    schedules: false,
    submission: false,
  });

  const [conflicts, setConflicts] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<
    Array<{ day: string; start: string; end: string }>
  >([]);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [sidebarScope, setSidebarScope] = useState<SidebarScope>("all");

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

  const { availableRooms: availableRoomsForType, selectedSection } =
    useRoomOptions({
      scheduleType: watched.scheduleType as "Onsite" | "Online",
      roomType: (watched.roomType || "Lecture") as "Lecture" | "Laboratory",
      sectionId: watched.section,
      sections,
      rooms,
      clearRoom: clearRoomCb,
      getSelectedRoomId: getRoomIdCb,
    });

  useEffect(() => {
    if (selectedSection) {
      form.setValue("level", selectedSection.grade_level as "11" | "12");
      form.setValue("strand", selectedSection.strand ?? "");
    }
  }, [selectedSection, form]);

  useEffect(() => {
    if (!isOnsite) return;
    const rt = (watched.roomType || "Lecture") as "Lecture" | "Laboratory";
    if (rt === "Lecture") {
      const assigned =
        selectedSection?.rooms?.filter((r) => r.type === "Lecture") ?? [];
      if (assigned.length > 0) {
        const firstId = assigned[0].id;
        if (form.getValues("room") !== firstId) form.setValue("room", firstId);
      } else if (form.getValues("room")) {
        form.setValue("room", undefined);
      }
    } else {
      const current = form.getValues("room");
      const stillValid = (availableRoomsForType ?? []).some(
        (r) => r.id === current
      );
      if (current && !stillValid) form.setValue("room", undefined);
    }
  }, [
    isOnsite,
    watched.roomType,
    watched.section,
    selectedSection,
    availableRoomsForType,
    form,
  ]);

  useEffect(() => {
    (async () => {
      await Promise.all([
        fetchProfessors(),
        fetchSubjects(),
        fetchRooms(),
        fetchSections(),
      ]);
      await loadSchedules();
    })();
  }, []);

  useEffect(() => {
    loadSchedules();
  }, [settings.schoolYear, settings.semester]);

  const fetchProfessors = async () => {
    setLoading((p) => ({ ...p, professors: true }));
    try {
      const res = await apiService.getProfessors();
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
      if (res.success && Array.isArray(res.data)) {
        setRooms(
          res.data
            .filter((r: any) => r && (r.room_id || r.id))
            .map((r: any) => ({
              id: (r.room_id || r.id).toString(),
              number: (r.room_number || r.number).toString(),
              type: (r.room_type || r.type || "Lecture") as
                | "Lecture"
                | "Laboratory",
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

  const loadSchedules = async () => {
    setLoading((p) => ({ ...p, schedules: true }));
    try {
      const res = await apiService.getSchedules?.({
        schoolYear: settings.schoolYear,
        semester: settings.semester,
      });
      if (res?.success && Array.isArray(res.data)) {
        const mapped: NormSchedule[] = res.data
          .filter(Boolean)
          .map((s: any) => ({
            id: String(s.id ?? s.sched_id ?? cryptoId()),
            subj_id: String(s.subj_id ?? s.subject_id ?? ""),
            prof_id: String(s.prof_id ?? s.professor_id ?? ""),
            section_id: String(s.section_id ?? s.section ?? ""),
            start: toMin((s.start_time ?? s.start ?? "").slice(0, 5)),
            end: toMin((s.end_time ?? s.end ?? "").slice(0, 5)),
            days: normalizeDays(s.days),
          }))
          .filter(
            (s) =>
              !Number.isNaN(s.start) &&
              !Number.isNaN(s.end) &&
              s.days.length > 0
          );
        setAllSchedules(mapped);
      } else {
        setAllSchedules([]);
      }
    } catch {
      setAllSchedules([]);
    } finally {
      setLoading((p) => ({ ...p, schedules: false }));
    }
  };

  const selectedProfessor = useMemo(
    () => professors.find((p) => p.id === watched.professorId),
    [professors, watched.professorId]
  );

  useEffect(() => {
    checkConflictsAndSuggest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    watched.section,
    watched.professorId,
    watched.subjectId,
    JSON.stringify(watched.days),
    watched.startTime,
    watched.endTime,
    watched.scheduleType,
    allSchedules,
  ]);

  async function checkConflictsAndSuggest() {
    const { section, professorId, subjectId, days, startTime, endTime, scheduleType } =
      form.getValues();

    const errs: string[] = [];
    const chosenDays = (days ?? []).map((d) => d.toLowerCase());
    const start = startTime ? toMin(startTime) : undefined;
    const end = endTime ? toMin(endTime) : undefined;

    if (section && subjectId) {
      const dup = allSchedules.some(
        (s) => s.section_id === section && s.subj_id === subjectId
      );
      if (dup)
        errs.push("This subject is already scheduled for the selected section.");
    }

    // lunch constraint for F2F
    if (scheduleType === "Onsite" && start !== undefined && end !== undefined) {
      const ls = toMin(LUNCH_START);
      const le = toMin(LUNCH_END);
      if (overlaps(start, end, ls, le)) {
        errs.push("Lunch break conflict: onsite classes cannot cross 12:00–1:00 PM.");
      }
    }

    if (start !== undefined && end !== undefined && chosenDays.length > 0) {
      const secOverlap = allSchedules.some(
        (s) =>
          s.section_id === section &&
          s.days.some((d) => chosenDays.includes(d)) &&
          overlaps(start, end, s.start, s.end)
      );
      if (secOverlap)
        errs.push(
          "Time conflict: another subject is already scheduled for this section at the selected time."
        );

      const profOverlap = allSchedules.some(
        (s) =>
          s.prof_id === professorId &&
          s.days.some((d) => chosenDays.includes(d)) &&
          overlaps(start, end, s.start, s.end)
      );
      if (profOverlap)
        errs.push(
          "Professor conflict: the professor is already assigned at the selected time."
        );
    }

    setConflicts(errs);

    const suggestions = suggestTimeSlots({
      sectionId: section,
      professorId,
      days: chosenDays,
      desiredDurationMin: deriveDesiredDuration(start, end, watched.roomType),
      schedules: allSchedules,
      scheduleType,
    });
    setSuggestions(suggestions);
  }

  function deriveDesiredDuration(
    start?: number,
    end?: number,
    _roomType?: "Lecture" | "Laboratory" | undefined
  ) {
    if (start !== undefined && end !== undefined && end > start) return end - start;
    return 60;
  }

  function suggestTimeSlots({
    sectionId,
    professorId,
    days,
    desiredDurationMin,
    schedules,
    scheduleType,
  }: {
    sectionId?: string;
    professorId?: string;
    days: string[];
    desiredDurationMin: number;
    schedules: NormSchedule[];
    scheduleType?: "Onsite" | "Online";
  }) {
    const result: Array<{ day: string; start: string; end: string }> = [];
    if (!sectionId || !professorId || days.length === 0) return result;

    const dayOrder = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const sortedDays = dayOrder.filter((d) => days.includes(d));
    const startBound = toMin(SCHOOL_START);
    const endBound = toMin(SCHOOL_END);
    const lunchStart = toMin(LUNCH_START);
    const lunchEnd = toMin(LUNCH_END);
    const isOnsiteLocal = scheduleType === "Onsite";

    for (const day of sortedDays) {
      const dayScheds = schedules.filter((s) => s.days.includes(day));

      for (
        let t = startBound;
        t + desiredDurationMin <= endBound && result.length < SUGGESTION_COUNT;
        t += 10
      ) {
        const tEnd = t + desiredDurationMin;

        // skip lunch overlap for onsite
        if (isOnsiteLocal && overlaps(t, tEnd, lunchStart, lunchEnd)) continue;

        const sectionClash = dayScheds.some(
          (s) => s.section_id === sectionId && overlaps(t, tEnd, s.start, s.end)
        );
        const profClash = dayScheds.some(
          (s) => s.prof_id === professorId && overlaps(t, tEnd, s.start, s.end)
        );

        if (!sectionClash && !profClash) {
          result.push({ day, start: fromMin(t), end: fromMin(tEnd) });
        }
      }
      if (result.length >= SUGGESTION_COUNT) break;
    }
    return result;
  }

  const onValid = async (values: z.infer<typeof scheduleFormSchema>) => {
    if (conflicts.length > 0) {
      setErrorMessage("Please resolve the conflicts before creating the schedule.");
      setShowError(true);
      return;
    }

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
      days: values.days,
    };

    setLoading((p) => ({ ...p, submission: true }));
    try {
      const response = await apiService.createSchedule(payload as any);
      if (response.success) {
        setShowSuccess(true);
        await loadSchedules();
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
    } catch {
      setErrorMessage("Unable to create schedule. Please check your connection and try again.");
      setShowError(true);
    } finally {
      setLoading((p) => ({ ...p, submission: false }));
    }
  };

  const onInvalid = () => {
    setErrorMessage("Please fill all required fields correctly.");
    setShowError(true);
  };

  const selectTimeSlot = (startTime: string, endTime: string) => {
    form.setValue("startTime", startTime);
    form.setValue("endTime", endTime);
  };

  // ---------- Sidebar (read-only list) ----------
  const profMap = useMemo(
    () =>
      professors.reduce<Record<string, string>>((acc, p) => {
        acc[p.id] = p.name;
        return acc;
      }, {}),
    [professors]
  );
  const subjMap = useMemo(
    () =>
      subjects.reduce<Record<string, { code: string; name: string }>>((acc, s) => {
        acc[s.id] = { code: s.code, name: s.name };
        return acc;
      }, {}),
    [subjects]
  );
  const sectionMap = useMemo(
    () =>
      sections.reduce<Record<string, { name: string; level: string; strand: string }>>(
        (acc, s) => {
          acc[s.id] = { name: s.name, level: s.grade_level, strand: s.strand || "" };
          return acc;
        },
        {}
      ),
    [sections]
  );

  const sidebarSchedules = useMemo(() => {
    const base = allSchedules.slice().sort((a, b) => a.start - b.start).slice(0, 150);
    const sectionId = watched.section;
    const profId = watched.professorId;

    let scoped = base;
    if (sidebarScope === "section" && sectionId) scoped = base.filter((s) => s.section_id === sectionId);
    else if (sidebarScope === "professor" && profId) scoped = base.filter((s) => s.prof_id === profId);

    return scoped.map((s) => {
      const subj = subjMap[s.subj_id];
      const sect = sectionMap[s.section_id];
      const profName = profMap[s.prof_id] || "—";
      return {
        id: s.id,
        subjCode: subj?.code ?? "—",
        subjName: subj?.name ?? "—",
        section: sect?.name ?? "—",
        level: sect?.level ?? "",
        strand: sect?.strand ?? "",
        prof: profName,
        timePretty: `${formatTime12h(fromMin(s.start))} – ${formatTime12h(fromMin(s.end))}`,
        daysShort: formatDaysShort(s.days),
      };
    });
  }, [allSchedules, sidebarScope, watched.section, watched.professorId, subjMap, sectionMap, profMap]);

  return (
    <div className="min-h-screen bg-gray-50 py-6 px-4">
      {/* Wider container and wider form column */}
      <div className="mx-auto w-full max-w-[88rem]">
        {/* Top toolbar with back action */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/scheduling")}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <span className="text-sm text-muted-foreground">
              <Link to="/scheduling" className="hover:underline">
                Scheduling
              </Link>{" "}
              / <span className="text-foreground">New</span>
            </span>
          </div>
        </div>

        {/* Page header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Calendar className="h-6 w-6" />
              {title}
            </h1>
            <p className="text-sm text-muted-foreground">
              Fill in the details to create a new class schedule.
            </p>
          </div>
        </div>

        {/* 12-col layout; form is wider (8) and sidebar (4) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT: form */}
          <div className="lg:col-span-8">
            <Card className="shadow">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Schedule Information</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Term is preselected from the system settings. Complete the class configuration below.
                </p>
              </CardHeader>
              <CardContent className="space-y-8">
                <Form {...form}>
                  <form id="schedule-form" onSubmit={form.handleSubmit(onValid, onInvalid)} className="space-y-8">
                    {/* Term (read-only) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-4 bg-blue-50 rounded-lg">
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

                    {/* Class & Subject */}
                    <div className="space-y-4">
                      <div className="text-sm font-medium text-muted-foreground">Class &amp; Subject</div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                      </div>
                    </div>

                    {/* Delivery & Room */}
                    <div className="space-y-4">
                      <div className="text-sm font-medium text-muted-foreground">Delivery &amp; Room</div>
                      {/* 3 cols: type (1), room selectors (span 2) for alignment */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <FormField
                          control={form.control}
                          name="scheduleType"
                          render={({ field }) => (
                            <FormItem className="md:col-span-1">
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
                        <div className="md:col-span-2">
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
                        </div>
                      </div>
                    </div>

                    {/* Schedule */}
                    <div className="space-y-4">
                      <div className="text-sm font-medium text-muted-foreground">Schedule</div>
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                        <FormField
                          control={form.control}
                          name="days"
                          render={() => (
                            <FormItem className="md:col-span-12">
                              <FormLabel>Days</FormLabel>
                              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
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
                        <FormField
                          control={form.control}
                          name="startTime"
                          render={({ field }) => (
                            <FormItem className="md:col-span-6">
                              <FormLabel className="flex items-center gap-2">
                                <Clock className="h-4 w-4" />
                                Start Time
                              </FormLabel>
                              <FormControl>
                                <Input type="time" step="600" min={SCHOOL_START} max={SCHOOL_END} {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="endTime"
                          render={({ field }) => (
                            <FormItem className="md:col-span-6">
                              <FormLabel>End Time</FormLabel>
                              <FormControl>
                                <Input type="time" step="600" min={SCHOOL_START} max={SCHOOL_END} {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* 👉 Suggestions right under time fields */}
                        {suggestions.length > 0 && (
                          <div className="md:col-span-12">
                            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm">
                              <div className="flex items-start gap-2">
                                <Lightbulb className="h-4 w-4 text-emerald-700 mt-0.5" />
                                <div className="w-full">
                                  <p className="font-medium text-emerald-800">
                                    Suggested available slots
                                  </p>
                                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                    {suggestions.map((s, i) => (
                                      <Button
                                        key={`${s.day}-${i}`}
                                        type="button"
                                        variant="secondary"
                                        className="h-8 justify-start"
                                        onClick={() => selectTimeSlot(s.start, s.end)}
                                      >
                                        <span className="truncate">
                                          {capitalize(s.day)} • {s.start}–{s.end}
                                        </span>
                                      </Button>
                                    ))}
                                  </div>
                                  <p className="mt-2 text-emerald-800">
                                    Working hours: {SCHOOL_START} – {SCHOOL_END}
                                    {isOnsite && (
                                      <span className="ml-2">
                                        • Lunch break (no onsite classes): {LUNCH_START}–{LUNCH_END}
                                      </span>
                                    )}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Assignment */}
                    <div className="space-y-4">
                      <div className="text-sm font-medium text-muted-foreground">Assignment</div>
                      <FormField
                        control={form.control}
                        name="professorId"
                        render={({ field }) => (
                          <FormItem className="max-w-xl">
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
                    </div>

                    {/* Conflicts */}
                    {conflicts.length > 0 && (
                      <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5" />
                          <div>
                            <p className="font-medium text-red-700">Conflicts detected:</p>
                            <ul className="list-disc ml-5 mt-1 text-red-700">
                              {conflicts.map((c, i) => (
                                <li key={i}>{c}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    )}
                  </form>
                </Form>

                {/* Bottom actions */}
                <div className="mt-6 flex flex-col sm:flex-row justify-end gap-2 border-t pt-4">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      if (onCancel) onCancel();
                      else if (typeof window !== "undefined") window.history.back();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    form="schedule-form"
                    disabled={loading.submission || (selectedProfessor?.subjectCount ?? 0) >= 8 || conflicts.length > 0}
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
                </div>

                {showSuccess && (
                  <div className="mt-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded">
                    Schedule created successfully! The new class has been added to the system.
                    <div className="mt-2">
                      <Button size="sm" onClick={() => setShowSuccess(false)}>
                        OK
                      </Button>
                    </div>
                  </div>
                )}

                {showError && (
                  <div className="mt-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded">
                    {errorMessage}
                    <div className="mt-2">
                      <Button size="sm" onClick={() => setShowError(false)}>
                        Close
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* RIGHT: read-only schedules sidebar */}
          <div className="lg:col-span-4">
            <Card className="sticky top-6">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Existing Schedules</CardTitle>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={sidebarScope === "all" ? "default" : "outline"}
                    onClick={() => setSidebarScope("all")}
                  >
                    <Filter className="mr-2 h-4 w-4" />
                    All
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={sidebarScope === "section" ? "default" : "outline"}
                    onClick={() => setSidebarScope("section")}
                    disabled={!watched.section}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    Same Section
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={sidebarScope === "professor" ? "default" : "outline"}
                    onClick={() => setSidebarScope("professor")}
                    disabled={!watched.professorId}
                  >
                    <Users className="mr-2 h-4 w-4" />
                    Same Professor
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="pt-0">
                {loading.schedules ? (
                  <div className="py-8 text-sm text-muted-foreground text-center">Loading schedules…</div>
                ) : sidebarSchedules.length === 0 ? (
                  <div className="py-8 text-sm text-muted-foreground text-center">No schedules to display.</div>
                ) : (
                  <div className="max-h-[70vh] overflow-y-auto pr-1 space-y-3">
                    {sidebarSchedules.map((s) => (
                      <div
                        key={s.id}
                        className="rounded-lg border bg-white p-3 hover:bg-muted/40 transition-colors"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{s.section}</span>
                            {s.level && (
                              <Badge variant="outline" className="h-5 px-2">
                                G{s.level} {s.strand}
                              </Badge>
                            )}
                          </div>
                          <div className="mt-1 flex items-center gap-2 text-sm">
                            <BookOpen className="h-4 w-4 text-muted-foreground" />
                            <span className="truncate">
                              {s.subjCode} — {s.subjName}
                            </span>
                          </div>
                        </div>

                        <div className="mt-2 grid grid-cols-1 gap-1 text-sm text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            <span className="truncate">{s.prof}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            <span className="truncate">
                              {s.timePretty} • {s.daysShort}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <p className="mt-3 text-xs text-muted-foreground">
                  This list is read-only and updates as you change the scope above.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScheduleForm;
