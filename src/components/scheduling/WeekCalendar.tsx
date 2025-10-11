// NEW FILE: src/components/scheduling/WeekCalendar.tsx
import React, { useMemo, useRef, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { CalendarDays } from "lucide-react";

export type WeekDay = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";

export interface WeekCalEvent {
  id: string;
  day: WeekDay;
  start: string; // "HH:MM"
  end: string;   // "HH:MM"
  title: string;
  subtitle?: string;
  meta?: string;
  schedule_type?: string;
  origin?: "auto" | "manual";
  raw?: any;
}

export interface WeekCalendarProps {
  events: WeekCalEvent[];
  startTime?: string;        // default "07:30"
  endTime?: string;          // default "16:30"
  defaultPxPerMin?: number;  // default 1.2
  onEventClick?: (e: WeekCalEvent) => void;
}

const DAY_ORDER: WeekDay[] = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"];
const DAY_LABEL: Record<WeekDay,string> = {
  monday:"Mon", tuesday:"Tue", wednesday:"Wed", thursday:"Thu", friday:"Fri", saturday:"Sat", sunday:"Sun"
};

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h*60 + m;
};
const fmt = (time: string) => {
  const [h, mm] = time.split(":").map(Number);
  const h12 = h % 12 || 12;
  return `${h12}:${mm.toString().padStart(2,"0")} ${h >= 12 ? "PM" : "AM"}`;
};
const todayKey = (): WeekDay | null => {
  return (["sunday","monday","tuesday","wednesday","thursday","friday","saturday"][new Date().getDay()] as WeekDay) ?? null;
};
const colorClassFor = (type?: string, origin?: "auto"|"manual") => {
  if (type === "Homeroom" || type === "Recess") return "bg-amber-100 border-amber-200";
  if (origin === "auto") return "bg-indigo-100 border-indigo-200";
  if (origin === "manual") return "bg-green-100 border-green-200";
  return "bg-slate-100 border-slate-200";
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

  const ticks = useMemo(() => {
    const out: { label: string; minutes: number }[] = [];
    for (let m = startMin; m <= endMin; m += 30) {
      const hh = Math.floor(m/60).toString().padStart(2,"0");
      const mm = (m%60).toString().padStart(2,"0");
      out.push({ label: fmt(`${hh}:${mm}`), minutes: m });
    }
    return out;
  }, [startMin, endMin]);

  type CalEvent = WeekCalEvent & { top: number; height: number; lane: number; lanesTotal: number; };
  const eventsByDay = useMemo(() => {
    const map: Record<WeekDay, CalEvent[]> = {
      monday:[], tuesday:[], wednesday:[], thursday:[], friday:[], saturday:[], sunday:[]
    };

    events.forEach((e) => {
      if (!DAY_ORDER.includes(e.day)) return;
      const s = Math.max(startMin, toMinutes(e.start));
      const eMin = Math.min(endMin, toMinutes(e.end));
      if (eMin <= s) return;

      map[e.day].push({
        ...e,
        top: (s - startMin) * pxPerMin,
        height: Math.max(2, (eMin - s) * pxPerMin),
        lane: 0,
        lanesTotal: 1,
      });
    });

    DAY_ORDER.forEach((day) => {
      const items = map[day].sort((a,b) => toMinutes(a.start) - toMinutes(b.start));
      const active: { lane: number; end: number }[] = [];

      items.forEach((ev) => {
        for (let i = active.length - 1; i >= 0; i--) {
          if (active[i].end <= toMinutes(ev.start)) active.splice(i,1);
        }
        const used = new Set(active.map(a=>a.lane));
        let lane = 0;
        while (used.has(lane)) lane++;
        ev.lane = lane;
        active.push({ lane, end: toMinutes(ev.end) });
        active.sort((a,b)=>a.lane-b.lane);
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

  const today = todayKey();
  const [nowTop, setNowTop] = useState<number | null>(null);
  useEffect(() => {
    const update = () => {
      const minutes = new Date().getHours()*60 + new Date().getMinutes();
      if (minutes < startMin || minutes > endMin) return setNowTop(null);
      setNowTop((minutes - startMin) * pxPerMin);
    };
    update();
    const id = setInterval(update, 60000);
    return () => clearInterval(id);
  }, [startMin, endMin, pxPerMin]);

  return (
    <div className="w-full overflow-auto rounded-lg border bg-white">
      <div className="sticky top-0 z-10 grid bg-white" style={{ gridTemplateColumns: "84px repeat(7, minmax(180px, 1fr))" }}>
        <div className="border-b p-3 text-sm font-medium text-muted-foreground flex items-center gap-2">
          <CalendarDays className="h-4 w-4" />
          Time
        </div>
        {DAY_ORDER.map((d) => (
          <div key={d} className={`border-b p-3 text-center font-medium ${today===d ? "text-primary" : ""}`}>
            {DAY_LABEL[d]}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between px-3 py-2 border-b">
        <div className="flex items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1">
            <span className="h-3 w-3 rounded bg-indigo-200 border border-indigo-300" /> Auto
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-3 w-3 rounded bg-green-200 border border-green-300" /> Manual
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-3 w-3 rounded bg-amber-200 border border-amber-300" /> Homeroom/Recess
          </span>
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

      <div className="grid" style={{ gridTemplateColumns: "84px repeat(7, minmax(180px, 1fr))" }}>
        {/* Ruler */}
        <div className="relative border-r">
          <div className="relative" style={{ height: windowMin * pxPerMin }}>
            {ticks.map((t) => (
              <div
                key={t.minutes}
                className="absolute w-full pr-2 text-right text-[11px] text-muted-foreground"
                style={{ top: (t.minutes - startMin) * pxPerMin - 7 }}
              >
                {t.label}
              </div>
            ))}
            {ticks.map((t) => (
              <div
                key={`line-${t.minutes}`}
                className="absolute w-full border-t border-dashed border-gray-200"
                style={{ top: (t.minutes - startMin) * pxPerMin }}
              />
            ))}
          </div>
        </div>

        {/* Days */}
        {DAY_ORDER.map((d) => {
          const items = eventsByDay[d];
          return (
            <div key={d} className="relative border-r" style={{ height: windowMin * pxPerMin }}>
              {ticks.map((t) => (
                <div
                  key={`g-${t.minutes}`}
                  className="absolute w-full border-t border-dashed border-gray-100"
                  style={{ top: (t.minutes - startMin) * pxPerMin }}
                />
              ))}

              {today === d && nowTop !== null && (
                <div className="absolute left-0 right-0" style={{ top: nowTop }}>
                  <div className="h-0.5 bg-red-500" />
                  <div className="absolute -top-2 left-1 bg-red-500 text-white text-[10px] px-1 py-[1px] rounded">
                    now
                  </div>
                </div>
              )}

              {items.map((ev) => {
                const GAP = 4;
                const laneWidth = `calc((100% - ${GAP * (ev.lanesTotal - 1)}px) / ${ev.lanesTotal})`;
                const left = `calc((${laneWidth}) * ${ev.lane} + ${GAP * ev.lane}px)`;
                const bgClass = colorClassFor(ev.schedule_type, ev.origin);

                return (
                  <div
                    key={`${ev.id}-${ev.day}`}
                    className="absolute rounded-md border shadow-sm cursor-pointer hover:shadow-md transition-shadow p-2 group overflow-hidden"
                    style={{ top: ev.top, height: ev.height, left, width: `calc(${laneWidth})` }}
                    onClick={() => onEventClick?.(ev)}
                  >
                    <div className={`absolute inset-0 rounded-md opacity-90 ${bgClass}`} />
                    <div className="relative h-full flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <div className="text-[11px] font-semibold truncate">{ev.title}</div>
                        <div className="text-[10px] text-muted-foreground ml-2 whitespace-nowrap">
                          {fmt(ev.start)}–{fmt(ev.end)}
                        </div>
                      </div>
                      {ev.subtitle && <div className="text-[11px] truncate">{ev.subtitle}</div>}
                      {ev.meta && <div className="text-[10px] text-muted-foreground truncate">{ev.meta}</div>}

                      {/* Tooltip */}
                      <div className="pointer-events-none absolute z-20 opacity-0 group-hover:opacity-100 transition-opacity bg-white border shadow-sm rounded p-2 text-[11px] left-1/2 -translate-x-1/2 -top-2 -translate-y-full w-max max-w-[220px]">
                        <div className="font-semibold">{ev.title}</div>
                        {ev.subtitle && <div className="text-muted-foreground">{ev.subtitle}</div>}
                        <div className="text-muted-foreground">{fmt(ev.start)}–{fmt(ev.end)}</div>
                        {ev.meta && <div className="text-muted-foreground">{ev.meta}</div>}
                        {ev.schedule_type && (
                          <div className="mt-1">
                            <Badge variant="outline" className="text-[10px]">{ev.schedule_type}</Badge>
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
