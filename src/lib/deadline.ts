// Shared deadline helpers. Deadlines may be stored as either:
//   - "YYYY-MM-DD"          (legacy date-only)
//   - "YYYY-MM-DDTHH:MM"    (current default, with time, e.g. 14:00)
//   - "YYYY-MM-DDTHH:MM:SS" (rare)
//
// All helpers below treat date-only as midnight local time.

export function parseDeadline(d: string | null | undefined): Date | null {
  if (!d) return null;
  // Length 10 = "YYYY-MM-DD", longer = ISO datetime.
  const iso = d.length === 10 ? `${d}T00:00:00` : d;
  const t = new Date(iso);
  return Number.isNaN(t.getTime()) ? null : t;
}

// Days until the deadline. Negative if overdue, 0 if today, positive if future.
// Uses local-time midnight comparison so a 2pm deadline today returns 0, not -0.5.
export function daysUntil(d: string | null | undefined): number | null {
  const due = parseDeadline(d);
  if (!due) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dueDate = new Date(due); dueDate.setHours(0, 0, 0, 0);
  return Math.round((dueDate.getTime() - today.getTime()) / 86400000);
}

// "5d", "0d", "-3d" — used in card chips.
export function deadlineCountdown(d: string | null | undefined): { label: string; cls: string } | null {
  const days = daysUntil(d);
  if (days === null) return null;
  if (days < 0)   return { label: `${days}d`, cls: "bg-red-100 text-red-700" };
  if (days === 0) return { label: `0d`,        cls: "bg-amber-100 text-amber-800" };
  if (days <= 7)  return { label: `${days}d`, cls: "bg-amber-100 text-amber-800" };
  return                   { label: `${days}d`, cls: "bg-emerald-50 text-emerald-700" };
}

// Human-readable: "May 8, 2026, 2:00 PM" — used in modal/dashboard.
export function formatDeadline(d: string | null | undefined): string {
  const t = parseDeadline(d);
  if (!t) return "";
  const hasTime = !!d && d.length > 10;
  return t.toLocaleString(undefined, hasTime
    ? { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }
    : { month: "short", day: "numeric", year: "numeric" }
  );
}
