import React, { useMemo, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { CalendarDays } from "lucide-react";

export type WeekDay =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export interface WeekCalEvent {
  id: string;
  day: WeekDay;
  start: string; // "HH:MM"
  end: string; // "HH:MM"
  title: string;
  subtitle?: string;
  meta?: string;
  schedule_type?: "Homeroom" | "Recess" | "Onsite" | "Online" | string;
  origin?: "auto" | "manual";
  raw?: any;
}

export interface WeekCalendarProps {
  events: WeekCalEvent[];
  startTime?: string; // default "07:30"
  endTime?: string; // default "16:30"
  defaultPxPerMin?: number; // default 1.2
  onEventClick?: (e: WeekCalEvent) => void;
}

const DAY_ORDER: WeekDay[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];
const DAY_LABEL: Record<WeekDay, string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
};

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
const fmt = (time: string) => {
  const [h, mm] = time.split(":").map(Number);
  const h12 = h % 12 || 12;
  return `${h12}:${mm.toString().padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
};
const todayKey = (): WeekDay | null => {
  return (
    ([
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ][new Date().getDay()] as WeekDay) ?? null
  );
};

/** Colors by schedule type (legend + event blocks) */
const typeColorClass = (type?: string) => {
  switch ((type || "").toLowerCase()) {
    case "homeroom":
      return "bg-amber-100 border-amber-200";
    case "recess":
      return "bg-slate-100 border-slate-200";
    case "onsite":
      return "bg-indigo-100 border-indigo-200";
    case "online":
      return "bg-purple-100 border-purple-200";
    default:
      return "bg-gray-100 border-gray-200";
  }
};
const typeDotClass = (type?: string) => {
  switch ((type || "").toLowerCase()) {
    case "homeroom":
      return "bg-amber-200 border-amber-300";
    case "recess":
      return "bg-slate-200 border-slate-300";
    case "onsite":
      return "bg-indigo-200 border-indigo-300";
    case "online":
      return "bg-purple-200 border-purple-300";
    default:
      return "bg-gray-200 border-gray-300";
  }
};
const typeAccentBar = (type?: string) => {
  switch ((type || "").toLowerCase()) {
    case "homeroom":
      return "before:bg-amber-400";
    case "recess":
      return "before:bg-slate-400";
    case "onsite":
      return "before:bg-indigo-500";
    case "online":
      return "before:bg-purple-500";
    default:
      return "before:bg-gray-400";
  }
};

export const WeekCalendar: React.FC<WeekCalendarProps> = ({
  events,
  startTime = "07:30",
  endTime = "16:30",
  defaultPxPerMin = 1.2,
  onEventClick,
}) => {
  const startMin = toMinutes(startTime);
  const endMin = toMinutes(endTime);
  const windowMin = Math.max(1, endMin - startMin);

  const [pxPerMin, setPxPerMin] = useState(defaultPxPerMin);

  /** Build hour + half-hour ticks (hour = solid, half-hour = dashed) */
  const ticks = useMemo(() => {
    const out: { label: string; minutes: number; major: boolean }[] = [];
    // align label at the top of each hour; include half-hour guides
    for (let m = startMin; m <= endMin; m += 30) {
      const isHour = m % 60 === 0;
      const hh = Math.floor(m / 60)
        .toString()
        .padStart(2, "0");
      const mm = (m % 60).toString().padStart(2, "0");
      out.push({ label: fmt(`${hh}:${mm}`), minutes: m, major: isHour });
    }
    return out;
  }, [startMin, endMin]);

  type CalEvent = WeekCalEvent & {
    top: number;
    height: number;
    lane: number;
    lanesTotal: number;
  };

  const eventsByDay = useMemo(() => {
    const map: Record<WeekDay, CalEvent[]> = {
      monday: [],
      tuesday: [],
      wednesday: [],
      thursday: [],
      friday: [],
      saturday: [],
      sunday: [],
    };

    events.forEach((e) => {
      if (!DAY_ORDER.includes(e.day)) return;
      const s = Math.max(startMin, toMinutes(e.start));
      const eMin = Math.min(endMin, toMinutes(e.end));
      if (eMin <= s) return;

      map[e.day].push({
        ...e,
        top: (s - startMin) * pxPerMin,
        height: Math.max(8, (eMin - s) * pxPerMin), // slight min height for readability
        lane: 0,
        lanesTotal: 1,
      });
    });

    DAY_ORDER.forEach((day) => {
      const items = map[day].sort(
        (a, b) => toMinutes(a.start) - toMinutes(b.start)
      );
      const active: { lane: number; end: number }[] = [];

      items.forEach((ev) => {
        for (let i = active.length - 1; i >= 0; i--) {
          if (active[i].end <= toMinutes(ev.start)) active.splice(i, 1);
        }
        const used = new Set(active.map((a) => a.lane));
        let lane = 0;
        while (used.has(lane)) lane++;
        ev.lane = lane;
        active.push({ lane, end: toMinutes(ev.end) });
        active.sort((a, b) => a.lane - b.lane);
      });

      items.forEach((ev, idx) => {
        const s1 = toMinutes(ev.start),
          e1 = toMinutes(ev.end);
        let maxLane = ev.lane;
        items.forEach((o, j) => {
          if (idx === j) return;
          const s2 = toMinutes(o.start),
            e2 = toMinutes(o.end);
          if (!(e2 <= s1 || s2 >= e1)) maxLane = Math.max(maxLane, o.lane);
        });
        ev.lanesTotal = Math.max(1, maxLane + 1);
      });

      map[day] = items;
    });

    return map;
  }, [events, startMin, endMin, pxPerMin]);

  /** Legend: show the schedule types present, ordered */
  const legend = useMemo(() => {
    const present = new Set<string>();
    for (const e of events) {
      const t = (e.schedule_type || "Other").toLowerCase();
      present.add(t);
    }
    const order = ["homeroom", "recess", "onsite", "online", "other"];
    const label = (t: string) =>
      t === "other" ? "Other" : t.charAt(0).toUpperCase() + t.slice(1);
    const items = order
      .filter((t) => present.has(t))
      .map((t) => ({ key: t, label: label(t), dotClass: typeDotClass(t) }));

    if (items.length === 0 && events.length > 0) {
      return [{ key: "other", label: "Other", dotClass: typeDotClass("other") }];
    }
    return items;
  }, [events]);

  /** Count per day for header badges */
  const countsByDay = useMemo(() => {
    const m = new Map<WeekDay, number>();
    DAY_ORDER.forEach((d) => m.set(d, 0));
    events.forEach((e) => m.set(e.day, (m.get(e.day) || 0) + 1));
    return m;
  }, [events]);

  const today = todayKey();
  const [nowTop, setNowTop] = useState<number | null>(null);
  useEffect(() => {
    const update = () => {
      const minutes = new Date().getHours() * 60 + new Date().getMinutes();
      if (minutes < startMin || minutes > endMin) return setNowTop(null);
      setNowTop((minutes - startMin) * pxPerMin);
    };
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [startMin, endMin, pxPerMin]);

  return (
    <div className="w-full overflow-auto rounded-xl border bg-white">
      {/* Header row with day labels (sticky) */}
      <div
        className="sticky top-0 z-20 grid bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/60"
        style={{ gridTemplateColumns: "88px repeat(7, minmax(200px, 1fr))" }}
      >
        <div className="border-b p-3 text-sm font-medium text-muted-foreground flex items-center gap-2">
          <CalendarDays className="h-4 w-4" />
          Time
        </div>
        {DAY_ORDER.map((d) => {
          const isToday = today === d;
          const count = countsByDay.get(d) || 0;
          return (
            <div
              key={d}
              className={`border-b p-3 text-center font-medium flex items-center justify-center gap-2 ${
                isToday ? "text-primary" : ""
              }`}
            >
              <span>{DAY_LABEL[d]}</span>
              {count > 0 && (
                <span className="text-[10px] px-1.5 py-[2px] rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                  {count}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend + Zoom (sticky subheader) */}
      <div className="sticky top-[41px] z-10 flex items-center justify-between px-3 py-2 border-b bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/50">
        <div className="flex items-center gap-2 text-xs flex-wrap">
          {legend.map((l) => (
            <span
              key={l.key}
              className="inline-flex items-center gap-1 rounded-full border px-2 py-[2px] bg-white"
            >
              <span className={`h-2.5 w-2.5 rounded-full border ${l.dotClass}`} />
              {l.label}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground w-14 text-right">
            Zoom
          </span>
          <Slider
            defaultValue={[defaultPxPerMin]}
            min={0.8}
            max={2.0}
            step={0.05}
            value={[pxPerMin]}
            onValueChange={(v) => setPxPerMin(v[0] ?? defaultPxPerMin)}
            className="w-44"
          />
        </div>
      </div>

      {/* Body grid */}
      <div
        className="grid"
        style={{ gridTemplateColumns: "88px repeat(7, minmax(200px, 1fr))" }}
      >
        {/* Time ruler (sticky left) */}
        <div className="relative border-r bg-white sticky left-0 z-10">
          <div
            className="relative"
            style={{ height: windowMin * pxPerMin }}
          >
            {ticks.map((t) => (
              <div
                key={`label-${t.minutes}`}
                className={`absolute w-full pr-2 text-right text-[11px] ${
                  t.major ? "text-slate-700" : "text-muted-foreground"
                }`}
                style={{ top: (t.minutes - startMin) * pxPerMin - 7 }}
              >
                {t.major ? t.label : ""}
              </div>
            ))}
            {ticks.map((t) => (
              <div
                key={`tick-${t.minutes}`}
                className={`absolute w-full ${
                  t.major
                    ? "border-t border-slate-200"
                    : "border-t border-dashed border-slate-200/70"
                }`}
                style={{ top: (t.minutes - startMin) * pxPerMin }}
              />
            ))}
          </div>
        </div>

        {/* Day columns */}
        {DAY_ORDER.map((d) => {
          const items = eventsByDay[d];
          const isToday = today === d;
          return (
            <div
              key={d}
              className={`relative border-r ${
                isToday ? "bg-primary/5" : "bg-white"
              }`}
              style={{ height: windowMin * pxPerMin }}
            >
              {/* Grid lines */}
              {ticks.map((t) => (
                <div
                  key={`g-${t.minutes}`}
                  className={`absolute w-full ${
                    t.major
                      ? "border-t border-slate-200"
                      : "border-t border-dashed border-slate-200/70"
                  }`}
                  style={{ top: (t.minutes - startMin) * pxPerMin }}
                />
              ))}

              {/* Now line (today) */}
              {isToday && nowTop !== null && (
                <div className="absolute left-0 right-0" style={{ top: nowTop }}>
                  <div className="h-0.5 bg-red-500" />
                  <div className="absolute -top-[5px] -left-[5px] h-2.5 w-2.5 rounded-full bg-red-500" />
                </div>
              )}

              {/* Events */}
              {items.map((ev) => {
                const GAP = 6;
                const laneWidth = `calc((100% - ${GAP * (ev.lanesTotal - 1)}px) / ${ev.lanesTotal})`;
                const left = `calc((${laneWidth}) * ${ev.lane} + ${GAP * ev.lane}px)`;
                const palette = typeColorClass(ev.schedule_type);
                const accent = typeAccentBar(ev.schedule_type);

                return (
                  <div
                    key={`${ev.id}-${ev.day}`}
                    className={`absolute rounded-lg border shadow-sm cursor-pointer hover:shadow-md transition-shadow p-2 group overflow-hidden
                                before:absolute before:left-0 before:top-0 before:h-full before:w-1 ${accent}`}
                    style={{
                      top: ev.top,
                      height: ev.height,
                      left,
                      width: `calc(${laneWidth})`,
                    }}
                    onClick={() => onEventClick?.(ev)}
                  >
                    <div className={`absolute inset-0 rounded-lg opacity-95 ${palette}`} />
                    <div className="relative h-full flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <div className="text-[12px] font-semibold truncate">
                          {ev.title}
                        </div>
                        <div className="text-[10px] text-slate-700/90 ml-2 whitespace-nowrap">
                          {fmt(ev.start)}–{fmt(ev.end)}
                        </div>
                      </div>
                      {ev.subtitle && (
                        <div className="text-[11px] truncate">{ev.subtitle}</div>
                      )}
                      {ev.meta && (
                        <div className="text-[10px] text-slate-700/80 truncate">
                          {ev.meta}
                        </div>
                      )}

                      {/* Hover tooltip */}
                      <div className="pointer-events-none absolute z-20 opacity-0 group-hover:opacity-100 transition-opacity bg-white border shadow-sm rounded p-2 text-[11px] left-1/2 -translate-x-1/2 -top-2 -translate-y-full w-max max-w-[240px]">
                        <div className="font-semibold">{ev.title}</div>
                        {ev.subtitle && (
                          <div className="text-muted-foreground">{ev.subtitle}</div>
                        )}
                        <div className="text-muted-foreground">
                          {fmt(ev.start)}–{fmt(ev.end)}
                        </div>
                        {ev.meta && (
                          <div className="text-muted-foreground">{ev.meta}</div>
                        )}
                        {ev.schedule_type && (
                          <div className="mt-1">
                            <Badge variant="outline" className="text-[10px]">
                              {ev.schedule_type}
                            </Badge>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};
