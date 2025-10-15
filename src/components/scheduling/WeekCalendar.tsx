import React, { useMemo, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { CalendarDays } from "lucide-react";

type LegendItem = {
  key: string;
  label: string;
  color: string;
  border?: string;  
};

export type WeekDay =
  | "monday" | "tuesday" | "wednesday" | "thursday"
  | "friday" | "saturday" | "sunday";

export interface WeekCalEvent {
  id: string;
  day: WeekDay;
  start: string; 
  end: string;   
  title: string;
  subtitle?: string;
  meta?: string;
  schedule_type?: "Homeroom" | "Recess" | "Onsite" | "Online" | string;
  online_mode?: "Synchronous" | "Asynchronous"; // NEW: used when schedule_type === "Online"
  origin?: "auto" | "manual";
  raw?: any;
}

export interface WeekCalendarProps {
  events: WeekCalEvent[];
  startTime?: string;         // default "07:30"
  endTime?: string;           // default "16:30"
  defaultPxPerMin?: number;   // default 1.2
  onEventClick?: (e: WeekCalEvent) => void;
}

/* ========== Constants ========== */
const DAY_ORDER: WeekDay[] = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"];
const DAY_LABEL: Record<WeekDay, string> = { monday:"Mon", tuesday:"Tue", wednesday:"Wed", thursday:"Thu", friday:"Fri", saturday:"Sat", sunday:"Sun" };

const COLOR_ONLINE_SYNC = "#99ffcc";
const COLOR_ONLINE_ASYNC = "#ff99ff";
const COLOR_ONSITE = "#ffffff";

/* ========== Utilities ========== */
const toMinutes = (hhmm: string) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
const fmt = (time: string) => { const [h, mm] = time.split(":").map(Number); const h12 = h % 12 || 12; return `${h12}:${mm.toString().padStart(2,"0")} ${h >= 12 ? "PM" : "AM"}`; };
const todayKey = (): WeekDay | null => (["sunday","monday","tuesday","wednesday","thursday","friday","saturday"][new Date().getDay()] as WeekDay) ?? null;

/* fallback classes for non-online types */
const fallbackType = (type?: string) => (type || "").toLowerCase();
const fallbackBgBorder = (type?: string) => {
  switch (fallbackType(type)) {
    case "homeroom": return { bg: "#fef3c7", border: "#fde68a", accent: "#f59e0b" };  // amber-100/200 + amber-500
    case "recess":   return { bg: "#f1f5f9", border: "#e2e8f0", accent: "#94a3b8" };  // slate-100/200 + slate-400
    case "onsite":   return { bg: COLOR_ONSITE, border: "#e5e7eb", accent: "#64748b" }; // white + gray-200 + slate-500
    case "online":   return { bg: "#f3e8ff", border: "#e9d5ff", accent: "#a855f7" };  // fallback if no mode
    default:         return { bg: "#f3f4f6", border: "#e5e7eb", accent: "#9ca3af" };  // gray-100/200 + gray-400
  }
};

/** Palette resolver honoring requested colors for online modes */
const resolvePalette = (ev: WeekCalEvent) => {
  if ((ev.schedule_type || "").toLowerCase() === "online") {
    if (ev.online_mode === "Synchronous") {
      return { bg: COLOR_ONLINE_SYNC, border: "#0f766e20", accent: "#0f766e" }; // teal-ish accent
    }
    if (ev.online_mode === "Asynchronous") {
      return { bg: COLOR_ONLINE_ASYNC, border: "#9d174d20", accent: "#9d174d" }; // rose-ish accent
    }
    // Online but mode unknown -> soft purple fallback
    return fallbackBgBorder("online");
  }
  if ((ev.schedule_type || "").toLowerCase() === "onsite") {
    return fallbackBgBorder("onsite");
  }
  return fallbackBgBorder(ev.schedule_type);
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

  /* hour + half-hour ticks */
  const ticks = useMemo(() => {
    const out: { label: string; minutes: number; major: boolean }[] = [];
    for (let m = startMin; m <= endMin; m += 30) {
      const isHour = m % 60 === 0;
      const hh = Math.floor(m / 60).toString().padStart(2, "0");
      const mm = (m % 60).toString().padStart(2, "0");
      out.push({ label: fmt(`${hh}:${mm}`), minutes: m, major: isHour });
    }
    return out;
  }, [startMin, endMin]);

  type CalEvent = WeekCalEvent & { top: number; height: number; lane: number; lanesTotal: number; };

  const eventsByDay = useMemo(() => {
    const map: Record<WeekDay, CalEvent[]> = {
      monday: [], tuesday: [], wednesday: [], thursday: [], friday: [], saturday: [], sunday: [],
    };

    events.forEach((e) => {
      if (!DAY_ORDER.includes(e.day)) return;
      const s = Math.max(startMin, toMinutes(e.start));
      const eMin = Math.min(endMin, toMinutes(e.end));
      if (eMin <= s) return;

      map[e.day].push({
        ...e,
        top: (s - startMin) * pxPerMin,
        height: Math.max(10, (eMin - s) * pxPerMin),
        lane: 0,
        lanesTotal: 1,
      });
    });

    // lane assignment + total lane computation
    DAY_ORDER.forEach((day) => {
      const items = map[day].sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
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
        const s1 = toMinutes(ev.start), e1 = toMinutes(ev.end);
        let maxLane = ev.lane;
        items.forEach((o, j) => {
          if (idx === j) return;
          const s2 = toMinutes(o.start), e2 = toMinutes(o.end);
          if (!(e2 <= s1 || s2 >= e1)) maxLane = Math.max(maxLane, o.lane);
        });
        ev.lanesTotal = Math.max(1, maxLane + 1);
      });

      map[day] = items;
    });

    return map;
  }, [events, startMin, endMin, pxPerMin]);

  /* Legend: force show the three requested + add others present */
  const legend = useMemo((): LegendItem[] => {
  const base: LegendItem[] = [
    { key: "online_sync",  label: "Online Synchronous",  color: COLOR_ONLINE_SYNC,  border: "#e5e7eb" },
    { key: "online_async", label: "Online Asynchronous", color: COLOR_ONLINE_ASYNC, border: "#e5e7eb" },
    { key: "onsite",       label: "Onsite",              color: COLOR_ONSITE,       border: "#e5e7eb" },
  ];

  const extrasSet = new Set<string>();
  for (const e of events) {
    const t = (e.schedule_type || "Other").toLowerCase();
    if (!["online", "onsite"].includes(t)) extrasSet.add(t);
  }
  const label = (t: string) => (t === "other" ? "Other" : t.charAt(0).toUpperCase() + t.slice(1));

  const extras: LegendItem[] = Array.from(extrasSet).map((t) => {
    const { bg, border } = fallbackBgBorder(t);
    return { key: `x-${t}`, label: label(t), color: bg, border };
  });

  return [...base, ...extras];
  }, [events]);


  /* Counts per day */
  const countsByDay = useMemo(() => {
    const m = new Map<WeekDay, number>();
    DAY_ORDER.forEach((d) => m.set(d, 0));
    events.forEach((e) => m.set(e.day, (m.get(e.day) || 0) + 1));
    return m;
  }, [events]);

  /* "Now" line */
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
      {/* Header row */}
      <div
        className="sticky top-0 z-20 grid bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/60 border-b"
        style={{ gridTemplateColumns: "88px repeat(7, minmax(200px, 1fr))" }}
      >
        <div className="p-3 text-sm font-medium text-muted-foreground flex items-center gap-2">
          <CalendarDays className="h-4 w-4" />
          Time
        </div>
        {DAY_ORDER.map((d) => {
          const isToday = today === d;
          const count = countsByDay.get(d) || 0;
          return (
            <div
              key={d}
              className={`p-3 text-center font-semibold tracking-wide flex items-center justify-center gap-2 ${
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

      {/* Legend + Zoom */}
      <div className="sticky top-[42px] z-10 flex items-center justify-between px-3 py-2 border-b bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="flex items-center gap-2 text-xs flex-wrap">
          {legend.map((l) => (
            <span
              key={l.key}
              className="inline-flex items-center gap-2 rounded-full border px-2.5 py-[4px] bg-white shadow-sm"
            >
              <span
                className="h-3.5 w-3.5 rounded-full border"
                style={{ backgroundColor: l.color, borderColor: l.border || "#e5e7eb" }}
              />
              <span className="font-medium">{l.label}</span>
            </span>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground w-14 text-right">Zoom</span>
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
      <div className="grid" style={{ gridTemplateColumns: "88px repeat(7, minmax(200px, 1fr))" }}>
        {/* Time ruler */}
        <div className="relative border-r bg-white sticky left-0 z-10">
          <div className="relative" style={{ height: windowMin * pxPerMin }}>
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
                  t.major ? "border-t border-slate-200" : "border-t border-dashed border-slate-200/70"
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
              className={`relative border-r ${isToday ? "bg-primary/5" : "bg-white"}`}
              style={{ height: windowMin * pxPerMin }}
            >
              {/* grid lines */}
              {ticks.map((t) => (
                <div
                  key={`g-${t.minutes}`}
                  className={`absolute w-full ${
                    t.major ? "border-t border-slate-200" : "border-t border-dashed border-slate-200/70"
                  }`}
                  style={{ top: (t.minutes - startMin) * pxPerMin }}
                />
              ))}

              {/* Now line */}
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
                const left = `calc(${laneWidth} * ${ev.lane} + ${GAP * ev.lane}px)`;
                const palette = resolvePalette(ev);

                const textColor = "#0f172a"; // slate-900
                const timeColor = "#334155"; // slate-700

                return (
                  <div
                    key={`${ev.id}-${ev.day}`}
                    className="absolute rounded-lg border shadow-sm hover:shadow-md transition-shadow p-2 group overflow-hidden cursor-pointer"
                    style={{
                      top: ev.top,
                      height: ev.height,
                      left,
                      width: laneWidth,
                      backgroundColor: palette.bg,
                      borderColor: palette.border,
                    }}
                    onClick={() => onEventClick?.(ev)}
                  >
                    {/* accent bar */}
                    <div
                      className="absolute left-0 top-0 h-full w-1 rounded-l"
                      style={{ backgroundColor: palette.accent }}
                    />
                    <div className="relative h-full pl-2.5 flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <div className="text-[12px] font-semibold truncate" style={{ color: textColor }}>
                          {ev.title}
                        </div>
                        <div className="text-[10px] ml-2 whitespace-nowrap" style={{ color: timeColor }}>
                          {fmt(ev.start)}–{fmt(ev.end)}
                        </div>
                      </div>
                      {ev.subtitle && (
                        <div className="text-[11px] truncate" style={{ color: textColor }}>
                          {ev.subtitle}
                        </div>
                      )}
                      {ev.meta && (
                        <div className="text-[10px] truncate" style={{ color: timeColor }}>
                          {ev.meta}
                        </div>
                      )}
                      {(ev.schedule_type || ev.online_mode) && (
                        <div className="mt-auto">
                          <Badge variant="outline" className="text-[10px]">
                            {ev.schedule_type === "Online" && ev.online_mode
                              ? `Online • ${ev.online_mode}`
                              : ev.schedule_type || "Other"}
                          </Badge>
                        </div>
                      )}

                      {/* Hover tooltip */}
                      <div className="pointer-events-none absolute z-20 opacity-0 group-hover:opacity-100 transition-opacity bg-white border shadow-sm rounded p-2 text-[11px] left-1/2 -translate-x-1/2 -top-2 -translate-y-full w-max max-w-[240px]">
                        <div className="font-semibold">{ev.title}</div>
                        {ev.subtitle && <div className="text-muted-foreground">{ev.subtitle}</div>}
                        <div className="text-muted-foreground">{fmt(ev.start)}–{fmt(ev.end)}</div>
                        {ev.meta && <div className="text-muted-foreground">{ev.meta}</div>}
                        {(ev.schedule_type || ev.online_mode) && (
                          <div className="mt-1">
                            <Badge variant="outline" className="text-[10px]">
                              {ev.schedule_type === "Online" && ev.online_mode
                                ? `Online • ${ev.online_mode}`
                                : ev.schedule_type || "Other"}
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
