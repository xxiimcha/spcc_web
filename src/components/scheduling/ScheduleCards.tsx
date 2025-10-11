import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  BookOpen,
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  MoreVertical,
  Pencil,
  ClipboardCheck,
  Trash2,
  Users,
} from "lucide-react";

/** Keep in sync with your page's Schedule type */
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

  /** Card click (open details) */
  onCardClick?: (schedule: Schedule) => void;

  /** “Change Professor” in the card actions */
  onEditProfessor?: (schedule: Schedule) => void;

  /** “Review” (only shown for auto + pending) */
  onReview?: (schedule: Schedule) => void;

  /** “Delete” in the card actions */
  onDelete?: (schedule: Schedule) => void;

  /** Grid columns on lg+ screens (default 3) */
  cols?: 1 | 2 | 3 | 4;
}

/* ----------------- Helpers ----------------- */

const formatTimeAMPM = (time: string) => {
  if (!time) return "";
  const [h, mm] = time.split(":");
  const hour = parseInt(h, 10);
  return `${hour % 12 || 12}:${mm} ${hour >= 12 ? "PM" : "AM"}`;
};

// Parse "07:30", "7:30", or "07:30:00" to minutes since 00:00
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
    <Badge className="bg-amber-100 text-amber-800 border-amber-200">Manual</Badge>
  );

const isReviewable = (s: Schedule) =>
  s.origin === "auto" && (s.status || "").toLowerCase() === "pending";

type Display = { subjCode: string; subjName: string; prof: string; type: string };
const displayFor = (s: Schedule): Display => {
  const startM = toMinutesAny(s.start_time);
  const endM = toMinutesAny(s.end_time);

  // 07:30–08:00 => Homeroom (ADVISER)
  if (startM === 450 && endM === 480) {
    return { subjCode: "HOMEROOM", subjName: "Homeroom", prof: "ADVISER", type: "Homeroom" };
  }
  // 08:00–08:30 => Recess (no prof)
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

/* ------------- Actions menu (kebab) ------------- */
const CardActionsMenu: React.FC<{
  schedule: Schedule;
  onEditProfessor?: (s: Schedule) => void;
  onReview?: (s: Schedule) => void;
  onDelete?: (s: Schedule) => void;
}> = ({ schedule, onEditProfessor, onReview, onDelete }) => (
  <DropdownMenu>
    <DropdownMenuTrigger
      asChild
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <Button size="icon" variant="ghost" className="h-8 w-8">
        <MoreVertical className="h-4 w-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
      <DropdownMenuLabel>Actions</DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={() => onEditProfessor?.(schedule)}>
        <Pencil className="mr-2 h-4 w-4" />
        Change Professor
      </DropdownMenuItem>
      {isReviewable(schedule) && (
        <DropdownMenuItem onClick={() => onReview?.(schedule)}>
          <ClipboardCheck className="mr-2 h-4 w-4" />
          Review
        </DropdownMenuItem>
      )}
      <DropdownMenuSeparator />
      <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => onDelete?.(schedule)}>
        <Trash2 className="mr-2 h-4 w-4" />
        Delete
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);

export const ScheduleCards: React.FC<ScheduleCardsProps> = ({
  schedules,
  onCardClick,
  onEditProfessor,
  onReview,
  onDelete,
  cols = 3,
}) => {
  return (
    <div className={`grid gap-4 ${gridCols(cols)}`}>
      {schedules.map((s) => {
        const d = displayFor(s);
        const stripe = leftStripeClass(s);

        return (
          <div
            key={s.schedule_id}
            role="button"
            onClick={() => onCardClick?.(s)}
            className={`relative overflow-hidden rounded-xl border bg-white hover:shadow-md transition-shadow cursor-pointer
                        before:absolute before:left-0 before:top-0 before:h-full before:w-1 ${stripe}`}
          >
            {/* Kebab */}
            <div className="absolute top-2 right-2 z-10">
              <CardActionsMenu
                schedule={s}
                onEditProfessor={onEditProfessor}
                onReview={onReview}
                onDelete={onDelete}
              />
            </div>

            {/* Header */}
            <div className="p-4 pb-3 pr-12">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <div className="text-base font-semibold truncate">{s.section_name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {s.level} • {s.strand}
                  </div>
                </div>
                {getOriginBadge(s.origin)}
              </div>
            </div>

            {/* Body */}
            <div className="px-4 pb-4 pr-12 space-y-2">
              <div className="flex items-start gap-2">
                <BookOpen className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{d.subjCode || s.schedule_type}</div>
                  <div className="text-xs text-muted-foreground truncate">{d.subjName}</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <div className="text-sm truncate">{d.prof || "—"}</div>
              </div>

              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div className="text-sm">
                  {formatTimeAMPM(s.start_time)} — {formatTimeAMPM(s.end_time)}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                <div className="flex flex-wrap gap-1">
                  {s.days.slice(0, 3).map((day) => (
                    <Badge key={day} variant="outline" className="text-xs">
                      {day.slice(0, 3)}
                    </Badge>
                  ))}
                  {s.days.length > 3 && (
                    <Badge variant="outline" className="text-xs">+{s.days.length - 3}</Badge>
                  )}
                </div>
              </div>

              {s.room_number && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <div className="text-sm">{s.room_number}</div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
