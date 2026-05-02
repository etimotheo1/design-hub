"use client";
import { useEffect, useRef, useState } from "react";

// Smooth date+time picker that wraps native HTML primitives in a friendlier UI.
// Returns ISO-ish "YYYY-MM-DDTHH:MM" strings — same format as <input type="datetime-local">,
// so the rest of the app (deadline parsing, validation) needs no changes.

interface Props {
  value: string | null;
  onChange: (next: string | null) => void;
  placeholder?: string;
  defaultHour?: number; // 24h hour for "date-only" picks. Default 14.
}

const TIME_PRESETS: Array<[string, number, number]> = [
  ["9:00 AM",  9, 0],
  ["12:00 PM", 12, 0],
  ["2:00 PM",  14, 0],
  ["5:00 PM",  17, 0],
];

function pad(n: number) { return n.toString().padStart(2, "0"); }

function fmtIsoLocal(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function parseValue(v: string | null): Date | null {
  if (!v) return null;
  const iso = v.length === 10 ? `${v}T00:00` : v;
  const t = new Date(iso);
  return Number.isNaN(t.getTime()) ? null : t;
}

function formatHuman(d: Date, hasTime: boolean): string {
  return d.toLocaleString(undefined, hasTime
    ? { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }
    : { month: "short", day: "numeric", year: "numeric" }
  );
}

function startOfMonth(d: Date): Date { const x = new Date(d); x.setDate(1); x.setHours(0,0,0,0); return x; }
function addMonths(d: Date, n: number): Date { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; }
function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function DateTimePicker({ value, onChange, placeholder = "Set a deadline", defaultHour = 14 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const parsed = parseValue(value);
  const [calendarMonth, setCalendarMonth] = useState<Date>(parsed ? startOfMonth(parsed) : startOfMonth(new Date()));

  // Close on click outside
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  function pick(date: Date, hour?: number, minute?: number) {
    const d = new Date(date);
    d.setHours(hour ?? (parsed?.getHours() ?? defaultHour), minute ?? (parsed?.getMinutes() ?? 0), 0, 0);
    onChange(fmtIsoLocal(d));
    setCalendarMonth(startOfMonth(d));
  }

  function pickPreset(daysFromToday: number) {
    const d = new Date(); d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + daysFromToday);
    pick(d, defaultHour, 0);
  }

  function pickNextMonday() {
    const d = new Date(); d.setHours(0, 0, 0, 0);
    const diff = (8 - d.getDay()) % 7 || 7;
    d.setDate(d.getDate() + diff);
    pick(d, defaultHour, 0);
  }

  function clear() {
    onChange(null);
    setOpen(false);
  }

  // Build calendar grid for current month view
  const monthStart = calendarMonth;
  const firstDayOfWeek = monthStart.getDay(); // 0 = Sun
  const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
  const today = new Date(); today.setHours(0,0,0,0);

  const grid: Array<Date | null> = [];
  for (let i = 0; i < firstDayOfWeek; i++) grid.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    grid.push(new Date(monthStart.getFullYear(), monthStart.getMonth(), day));
  }
  while (grid.length % 7 !== 0) grid.push(null);

  const hasTime = !!value && value.length > 10;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full text-left rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white hover:bg-slate-50 transition flex items-center justify-between gap-2 ${open ? "ring-2 ring-indigo-500" : ""}`}
      >
        <span className="flex items-center gap-2 truncate">
          <span className="text-slate-400">📅</span>
          {parsed
            ? <span className="text-slate-900">{formatHuman(parsed, hasTime || true)}</span>
            : <span className="text-slate-400">{placeholder}</span>}
        </span>
        {parsed && (
          <span
            onClick={(e) => { e.stopPropagation(); clear(); }}
            className="text-slate-400 hover:text-slate-700 px-1"
            role="button"
            aria-label="Clear deadline"
          >×</span>
        )}
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-[300px] bg-white rounded-xl border border-slate-200 shadow-xl p-3">
          {/* Quick presets */}
          <div className="grid grid-cols-3 gap-1.5 mb-3">
            <PresetBtn onClick={() => pickPreset(0)}>Today</PresetBtn>
            <PresetBtn onClick={() => pickPreset(1)}>Tomorrow</PresetBtn>
            <PresetBtn onClick={pickNextMonday}>Next Mon</PresetBtn>
            <PresetBtn onClick={() => pickPreset(7)}>+1 week</PresetBtn>
            <PresetBtn onClick={() => pickPreset(14)}>+2 weeks</PresetBtn>
            <PresetBtn onClick={() => pickPreset(30)}>+1 month</PresetBtn>
          </div>

          {/* Month nav */}
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={() => setCalendarMonth(addMonths(calendarMonth, -1))}
              className="p-1 rounded hover:bg-slate-100 text-slate-600 text-sm"
              aria-label="Previous month"
            >‹</button>
            <span className="text-sm font-medium text-slate-800">
              {calendarMonth.toLocaleString(undefined, { month: "long", year: "numeric" })}
            </span>
            <button
              type="button"
              onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))}
              className="p-1 rounded hover:bg-slate-100 text-slate-600 text-sm"
              aria-label="Next month"
            >›</button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 gap-0.5 mb-1 text-[10px] text-slate-500 text-center font-medium uppercase">
            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <div key={i}>{d}</div>)}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-0.5 mb-3">
            {grid.map((d, i) => {
              if (!d) return <div key={i} />;
              const isToday    = isSameDay(d, today);
              const isSelected = parsed && isSameDay(d, parsed);
              const isPast     = d.getTime() < today.getTime();
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => pick(d)}
                  className={`text-xs h-8 rounded-md transition
                    ${isSelected ? "bg-indigo-600 text-white font-semibold"
                      : isToday  ? "ring-1 ring-indigo-300 text-indigo-700 hover:bg-indigo-50"
                      : isPast   ? "text-slate-300 hover:bg-slate-50 hover:text-slate-500"
                      : "text-slate-700 hover:bg-slate-100"}`}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>

          {/* Time presets + custom time */}
          <div className="border-t border-slate-100 pt-3">
            <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold mb-1.5">Time</div>
            <div className="grid grid-cols-4 gap-1 mb-2">
              {TIME_PRESETS.map(([label, h, m]) => {
                const selected = !!parsed && parsed.getHours() === h && parsed.getMinutes() === m;
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => {
                      if (parsed) pick(parsed, h, m);
                      else { const d = new Date(); d.setHours(0,0,0,0); pick(d, h, m); }
                    }}
                    className={`text-[11px] py-1 rounded-md transition
                      ${selected ? "bg-indigo-100 text-indigo-800 ring-1 ring-indigo-300 font-medium"
                                 : "bg-slate-50 text-slate-600 hover:bg-slate-100"}`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <input
              type="time"
              value={parsed ? `${pad(parsed.getHours())}:${pad(parsed.getMinutes())}` : ""}
              onChange={(e) => {
                const [hh, mm] = e.target.value.split(":").map(Number);
                if (Number.isFinite(hh) && Number.isFinite(mm)) {
                  if (parsed) pick(parsed, hh, mm);
                  else { const d = new Date(); d.setHours(0,0,0,0); pick(d, hh, mm); }
                }
              }}
              className="w-full text-sm rounded-md border border-slate-300 px-2 py-1"
            />
          </div>

          <div className="mt-3 flex items-center justify-between">
            <button
              type="button"
              onClick={clear}
              className="text-xs text-slate-500 hover:text-slate-800"
            >Clear</button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs px-3 py-1 rounded-md bg-slate-900 text-white hover:bg-slate-800"
            >Done</button>
          </div>
        </div>
      )}
    </div>
  );
}

function PresetBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-xs py-1.5 rounded-md bg-slate-50 text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200 transition"
    >
      {children}
    </button>
  );
}
