import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/components/ui/use-toast";
import { apiService } from "@/services/apiService";
import {
  BookOpen,
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  MoreVertical,
  Users,
} from "lucide-react";
import { WeekCalendar, WeekCalEvent } from "@/components/scheduling/WeekCalendar";

/** Keep in sync with page's Schedule type */
export type Origin = "auto" | "manual";
export interface Schedule {
  schedule_id: string;
  school_year: string;
  semester: string;
  subj_code: string;
  subj_name: string;
  professor_name: string;
  section_name: string;
  schedule_type: string; // "Onsite", "Homeroom", "Recess", etc.
  start_time: string;     // "HH:MM" or "HH:MM:SS"
  end_time: string;       // "HH:MM" or "HH:MM:SS"
  days: string[];
  room_number: string | null;
  room_type: string | null;
  level: string;
  strand: string;
  origin: Origin;
  status?: string;
}

export interface ScheduleCardsProps {
  schedules: Schedule[];
  onScheduleClick?: (schedule: Schedule) => void;

  /** Optional: page can refresh or patch state after deletion */
  onDeleted?: (sectionName: string, removedIds: string[]) => void;

  /** @deprecated Kept for compatibility; no longer needed if onDeleted is used */
  onDeleteSection?: (sectionName: string, items: Schedule[]) => void;

  cols?: 1 | 2 | 3 | 4;
  calendarMode?: "dialog" | "side";
}

/* ----------------- Helpers ----------------- */

const formatTimeAMPM = (time: string) => {
  if (!time) return "";
  const [h, mm] = time.split(":");
  const hour = parseInt(h, 10);
  return `${hour % 12 || 12}:${mm} ${hour >= 12 ? "PM" : "AM"}`;
};

const toMinutesAny = (t: string) => {
  if (!t) return NaN;
  const parts = t.trim().split(":");
  const h = parseInt(parts[0] || "0", 10);
  const m = parseInt(parts[1] || "0", 10);
  return h * 60 + m;
};

const getOriginBadge = (origin: Origin) =>
  origin === "auto" ? (
    <Badge className="bg-indigo-100 text-indigo-800 border-indigo-200">Auto</Badge>
  ) : (
    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Manual</Badge>
  );

type Display = { subjCode: string; subjName: string; prof: string; type: string };
const displayFor = (s: Schedule): Display => {
  const startM = toMinutesAny(s.start_time);
  const endM = toMinutesAny(s.end_time);
  if (startM === 450 && endM === 480) {
    return { subjCode: "HOMEROOM", subjName: "Homeroom", prof: "ADVISER", type: "Homeroom" };
  }
  if (startM === 480 && endM === 510) {
    return { subjCode: "RECESS", subjName: "Recess", prof: "", type: "Recess" };
  }
  return {
    subjCode: s.subj_code || s.schedule_type || "",
    subjName: s.subj_name || "",
    prof: s.professor_name || "",
    type: s.schedule_type || "",
  };
};

const leftStripeClass = (s: Schedule) => {
  const t = displayFor(s).type.toLowerCase();
  if (t === "homeroom") return "before:bg-amber-400";
  if (t === "recess") return "before:bg-slate-400";
  return s.origin === "auto" ? "before:bg-indigo-400" : "before:bg-emerald-400";
};

const gridCols = (cols?: number) => {
  switch (cols) {
    case 1: return "grid-cols-1";
    case 2: return "grid-cols-1 md:grid-cols-2";
    case 4: return "grid-cols-1 md:grid-cols-2 lg:grid-cols-4";
    case 3:
    default: return "grid-cols-1 md:grid-cols-2 lg:grid-cols-3";
  }
};

/* ----------------- Grouping ----------------- */

type SectionGroup = {
  key: string;
  name: string;
  level?: string;
  strand?: string;
  items: Schedule[];
};

const useSectionGroups = (schedules: Schedule[]) => {
  return React.useMemo<SectionGroup[]>(() => {
    const map = new Map<string, SectionGroup>();
    for (const s of schedules) {
      const key = s.section_name.trim();
      if (!map.has(key)) {
        map.set(key, {
          key,
          name: s.section_name,
          level: s.level,
          strand: s.strand,
          items: [],
        });
      }
      map.get(key)!.items.push(s);
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [schedules]);
};

/* ----------------- Convert to WeekCalendar events ----------------- */

const toWeekEvents = (group: SectionGroup): WeekCalEvent[] => {
  const events: WeekCalEvent[] = [];
  group.items.forEach((s) => {
    const d = displayFor(s);
    (s.days || []).forEach((day) => {
      const dayLower = (day || "").toLowerCase() as WeekCalEvent["day"];
      events.push({
        id: `${s.schedule_id}-${dayLower}`,
        day: dayLower,
        start: s.start_time.slice(0, 5),
        end: s.end_time.slice(0, 5),
        title: d.subjCode || s.schedule_type,
        subtitle: d.subjName || "",
        meta: `${d.prof || "—"}${s.room_number ? ` • ${s.room_number}` : ""}`,
        schedule_type: s.schedule_type,
        origin: s.origin,
        raw: s,
      });
    });
  });
  return events;
};

/* ----------------- Section actions ----------------- */

const SectionActionsMenu: React.FC<{
  section: SectionGroup;
  // instead of directly deleting, we ask parent component to open confirm
  onAskDelete: (section: SectionGroup) => void;
}> = ({ section, onAskDelete }) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button size="icon" variant="ghost" className="h-8 w-8">
        <MoreVertical className="h-4 w-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuLabel>Actions</DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        className="text-red-600 focus:text-red-600"
        onClick={(e) => {
          e.stopPropagation();
          onAskDelete(section);
        }}
      >
        Delete Section Schedules
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);

/* ----------------- Main ----------------- */

export const ScheduleCards: React.FC<ScheduleCardsProps> = ({
  schedules,
  onScheduleClick,
  onDeleted,            // <<< notify page when done
  onDeleteSection,      // <<< legacy; still supported
  cols = 3,
  calendarMode = "dialog",
}) => {
  const groups = useSectionGroups(schedules);
  const [selected, setSelected] = React.useState<SectionGroup | null>(null);
  const [open, setOpen] = React.useState(false);

  // >>> Deletion wiring
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [sectionToDelete, setSectionToDelete] = React.useState<SectionGroup | null>(null);
  const [busy, setBusy] = React.useState(false);

  const askDelete = (g: SectionGroup) => {
    setSectionToDelete(g);
    setConfirmOpen(true);
  };

  const performDelete = async () => {
    if (!sectionToDelete) return;

    // 1) Prepare both numeric and string id arrays
    const numericIds = sectionToDelete.items
      .map(i => Number(String(i.schedule_id)))
      .filter(n => Number.isFinite(n) && n > 0);

    if (numericIds.length === 0) return;

    const stringIds = numericIds.map(String); // for callbacks typed as string[]

    setBusy(true);
    try {
      // 2) Use bulk if available
      if (typeof (apiService as any).deleteSchedulesBulk === "function") {
        const res = await (apiService as any).deleteSchedulesBulk(numericIds);
        if (!res?.success) throw new Error(res?.message || "Bulk delete failed");
      } else {
        // 3) Fallback: sequential deletion
        for (const id of numericIds) {
          const r = await apiService.deleteSchedule(id as any);
          if (!r?.success) throw new Error(r?.message || "Delete failed");
        }
      }

      toast({
        title: "Deleted",
        description: `Removed ${numericIds.length} schedule${numericIds.length > 1 ? "s" : ""} from ${sectionToDelete.name}.`,
      });

      // 4) Notify parent (string[] as per the prop type)
      onDeleted?.(sectionToDelete.name, stringIds);
      // legacy callback still supported
      onDeleteSection?.(sectionToDelete.name, sectionToDelete.items);

      setConfirmOpen(false);
      setSectionToDelete(null);
    } catch (e: any) {
      toast({
        title: "Error",
        description: e?.message || "Failed to delete schedules.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  // <<< Deletion wiring

  const openCalendarFor = (g: SectionGroup) => {
    if (calendarMode === "dialog") {
      setSelected(g);
      setOpen(true);
    } else {
      setSelected(g);
    }
  };

  return (
    <div className={`w-full ${calendarMode === "side" ? "grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-4" : ""}`}>
      {/* GRID */}
      <div>
        <div className={`grid gap-4 ${gridCols(cols)}`}>
          {groups.map((g) => {
            const preview = g.items.slice(0, 2);
            const total = g.items.length;
            return (
              <div
                key={g.key}
                role="button"
                onClick={() => openCalendarFor(g)}
                className="relative overflow-hidden rounded-xl border bg-white hover:shadow-md transition-shadow cursor-pointer"
              >
                <div className="absolute top-2 right-2 z-10">
                  <SectionActionsMenu section={g} onAskDelete={askDelete} />
                </div>

                {/* Header */}
                <div className="p-4 pr-12">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <div className="text-base font-semibold truncate">{g.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        Grade {g.level ?? "—"} • {g.strand ?? "—"}
                      </div>
                    </div>
                    <Badge variant="secondary">{total} class{total !== 1 ? "es" : ""}</Badge>
                  </div>
                </div>

                {/* Body preview */}
                <div className="px-4 pb-4 space-y-2">
                  {preview.map((s) => {
                    const d = displayFor(s);
                    const stripe = leftStripeClass(s);
                    return (
                      <div
                        key={s.schedule_id}
                        className={`relative rounded-lg border p-2 pr-3 before:absolute before:left-0 before:top-0 before:h-full before:w-1 ${stripe}`}
                      >
                        <div className="flex items-start gap-2">
                          <BookOpen className="h-4 w-4 text-muted-foreground mt-0.5" />
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">
                              {d.subjCode || s.schedule_type}{" "}
                              <span className="text-xs text-muted-foreground">({d.subjName})</span>
                            </div>
                            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-1">
                              <span className="inline-flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {d.prof || "—"}
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatTimeAMPM(s.start_time)}–{formatTimeAMPM(s.end_time)}
                              </span>
                              {s.room_number && (
                                <span className="inline-flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {s.room_number}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {total > preview.length && (
                    <div className="text-xs text-muted-foreground pl-1">+{total - preview.length} more…</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SIDE PANEL */}
      {calendarMode === "side" && (
        <div className="hidden lg:block rounded-xl border bg-white p-4 sticky top-4 h-fit">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="text-sm text-muted-foreground">Section</div>
              <div className="text-lg font-semibold">{selected?.name ?? "—"}</div>
            </div>
          </div>
          {selected ? (
            <WeekCalendar
              events={toWeekEvents(selected)}
              startTime="07:30"
              endTime="16:30"
              defaultPxPerMin={1.2}
              onEventClick={(ev) => onScheduleClick?.(ev.raw)}
            />
          ) : (
            <div className="text-sm text-muted-foreground">
              Select a section to preview its weekly calendar.
            </div>
          )}
        </div>
      )}

      {/* DIALOG — wider + guaranteed scrollbar */}
      {calendarMode === "dialog" && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent
            className="
              w-[98vw] sm:w-auto sm:max-w-[95vw] lg:max-w-[1320px] xl:max-w-[1440px]
              p-0
              max-h-[92vh]
              overflow-hidden
            "
          >
            <div className="flex flex-col h-[88vh] sm:h-[82vh]">
              <DialogHeader className="px-4 pt-4 pb-2">
                <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <CalendarIcon className="h-5 w-5" />
                  {selected?.name ?? "Section"}
                </DialogTitle>
              </DialogHeader>

              {/* Scrollable area for the calendar */}
              <div className="px-2 sm:px-4 pb-4 flex-1 min-h-0 overflow-auto overscroll-contain">
                {selected && (
                  <div className="rounded-lg border bg-white">
                    <WeekCalendar
                      events={toWeekEvents(selected)}
                      startTime="07:30"
                      endTime="16:30"
                      defaultPxPerMin={1.2}
                      onEventClick={(ev) => onScheduleClick?.(ev.raw)}
                    />
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Confirm deletion dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete all schedules for this section?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{" "}
              <strong>{sectionToDelete?.items.length ?? 0}</strong> schedule
              {sectionToDelete && sectionToDelete.items.length !== 1 ? "s" : ""} in{" "}
              <em>{sectionToDelete?.name}</em>. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={performDelete}
              disabled={busy}
            >
              {busy ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
