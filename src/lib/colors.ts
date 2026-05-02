// A small palette of color tokens used to label projects and categories.
// We map each token to a fixed set of Tailwind classes (rather than templating
// strings dynamically) so Tailwind's JIT compiler picks them up at build time.
//
// IMPORTANT: this file MUST be in tailwind.config.ts's `content` paths so the
// JIT scanner finds these literal class strings. Otherwise classes like
// `bg-emerald-500` won't end up in the compiled CSS.

export type ColorToken =
  | "emerald" | "sky" | "amber" | "indigo" | "pink" | "violet"
  | "rose" | "cyan" | "slate" | "blue" | "red" | "teal";

export const COLOR_TOKENS: ColorToken[] = [
  "emerald", "sky", "amber", "indigo", "pink", "violet",
  "rose", "cyan", "slate", "blue", "red", "teal",
];

export interface ColorClasses {
  dot: string;             // small filled circle
  stripe: string;          // bg color for top stripe / accent bar
  chip: string;            // unselected chip background + text
  chipHover: string;       // hover variant
  chipSelected: string;    // selected chip background + text + ring
  cardBg: string;          // soft background tint when card is selected
  cardSelected: string;    // selected card border + ring
  cardSelectedDot: string; // selected card corner indicator
  text: string;
  buttonBg: string;        // strong background for primary action button
  buttonHoverBg: string;   // hover state for action button
}

const MAP: Record<ColorToken, ColorClasses> = {
  emerald: {
    dot: "bg-emerald-500", stripe: "bg-emerald-500",
    chip: "bg-emerald-50 text-emerald-700", chipHover: "hover:bg-emerald-100",
    chipSelected: "bg-emerald-100 text-emerald-900 ring-2 ring-emerald-300",
    cardBg: "bg-emerald-50",
    cardSelected: "border-emerald-500 ring-4 ring-emerald-200",
    cardSelectedDot: "bg-emerald-500", text: "text-emerald-700",
    buttonBg: "bg-emerald-600", buttonHoverBg: "hover:bg-emerald-700",
  },
  sky: {
    dot: "bg-sky-500", stripe: "bg-sky-500",
    chip: "bg-sky-50 text-sky-700", chipHover: "hover:bg-sky-100",
    chipSelected: "bg-sky-100 text-sky-900 ring-2 ring-sky-300",
    cardBg: "bg-sky-50",
    cardSelected: "border-sky-500 ring-4 ring-sky-200",
    cardSelectedDot: "bg-sky-500", text: "text-sky-700",
    buttonBg: "bg-sky-600", buttonHoverBg: "hover:bg-sky-700",
  },
  amber: {
    dot: "bg-amber-500", stripe: "bg-amber-500",
    chip: "bg-amber-50 text-amber-800", chipHover: "hover:bg-amber-100",
    chipSelected: "bg-amber-100 text-amber-900 ring-2 ring-amber-300",
    cardBg: "bg-amber-50",
    cardSelected: "border-amber-500 ring-4 ring-amber-200",
    cardSelectedDot: "bg-amber-500", text: "text-amber-800",
    buttonBg: "bg-amber-600", buttonHoverBg: "hover:bg-amber-700",
  },
  indigo: {
    dot: "bg-indigo-500", stripe: "bg-indigo-500",
    chip: "bg-indigo-50 text-indigo-700", chipHover: "hover:bg-indigo-100",
    chipSelected: "bg-indigo-100 text-indigo-900 ring-2 ring-indigo-300",
    cardBg: "bg-indigo-50",
    cardSelected: "border-indigo-500 ring-4 ring-indigo-200",
    cardSelectedDot: "bg-indigo-500", text: "text-indigo-700",
    buttonBg: "bg-indigo-600", buttonHoverBg: "hover:bg-indigo-700",
  },
  pink: {
    dot: "bg-pink-500", stripe: "bg-pink-500",
    chip: "bg-pink-50 text-pink-700", chipHover: "hover:bg-pink-100",
    chipSelected: "bg-pink-100 text-pink-900 ring-2 ring-pink-300",
    cardBg: "bg-pink-50",
    cardSelected: "border-pink-500 ring-4 ring-pink-200",
    cardSelectedDot: "bg-pink-500", text: "text-pink-700",
    buttonBg: "bg-pink-600", buttonHoverBg: "hover:bg-pink-700",
  },
  violet: {
    dot: "bg-violet-500", stripe: "bg-violet-500",
    chip: "bg-violet-50 text-violet-700", chipHover: "hover:bg-violet-100",
    chipSelected: "bg-violet-100 text-violet-900 ring-2 ring-violet-300",
    cardBg: "bg-violet-50",
    cardSelected: "border-violet-500 ring-4 ring-violet-200",
    cardSelectedDot: "bg-violet-500", text: "text-violet-700",
    buttonBg: "bg-violet-600", buttonHoverBg: "hover:bg-violet-700",
  },
  rose: {
    dot: "bg-rose-500", stripe: "bg-rose-500",
    chip: "bg-rose-50 text-rose-700", chipHover: "hover:bg-rose-100",
    chipSelected: "bg-rose-100 text-rose-900 ring-2 ring-rose-300",
    cardBg: "bg-rose-50",
    cardSelected: "border-rose-500 ring-4 ring-rose-200",
    cardSelectedDot: "bg-rose-500", text: "text-rose-700",
    buttonBg: "bg-rose-600", buttonHoverBg: "hover:bg-rose-700",
  },
  cyan: {
    dot: "bg-cyan-500", stripe: "bg-cyan-500",
    chip: "bg-cyan-50 text-cyan-700", chipHover: "hover:bg-cyan-100",
    chipSelected: "bg-cyan-100 text-cyan-900 ring-2 ring-cyan-300",
    cardBg: "bg-cyan-50",
    cardSelected: "border-cyan-500 ring-4 ring-cyan-200",
    cardSelectedDot: "bg-cyan-500", text: "text-cyan-700",
    buttonBg: "bg-cyan-600", buttonHoverBg: "hover:bg-cyan-700",
  },
  slate: {
    dot: "bg-slate-500", stripe: "bg-slate-400",
    chip: "bg-slate-100 text-slate-700", chipHover: "hover:bg-slate-200",
    chipSelected: "bg-slate-200 text-slate-900 ring-2 ring-slate-300",
    cardBg: "bg-slate-100",
    cardSelected: "border-slate-500 ring-4 ring-slate-200",
    cardSelectedDot: "bg-slate-500", text: "text-slate-700",
    buttonBg: "bg-slate-700", buttonHoverBg: "hover:bg-slate-800",
  },
  blue: {
    dot: "bg-blue-500", stripe: "bg-blue-500",
    chip: "bg-blue-50 text-blue-700", chipHover: "hover:bg-blue-100",
    chipSelected: "bg-blue-100 text-blue-900 ring-2 ring-blue-300",
    cardBg: "bg-blue-50",
    cardSelected: "border-blue-500 ring-4 ring-blue-200",
    cardSelectedDot: "bg-blue-500", text: "text-blue-700",
    buttonBg: "bg-blue-600", buttonHoverBg: "hover:bg-blue-700",
  },
  red: {
    dot: "bg-red-500", stripe: "bg-red-500",
    chip: "bg-red-50 text-red-700", chipHover: "hover:bg-red-100",
    chipSelected: "bg-red-100 text-red-900 ring-2 ring-red-300",
    cardBg: "bg-red-50",
    cardSelected: "border-red-500 ring-4 ring-red-200",
    cardSelectedDot: "bg-red-500", text: "text-red-700",
    buttonBg: "bg-red-600", buttonHoverBg: "hover:bg-red-700",
  },
  teal: {
    dot: "bg-teal-500", stripe: "bg-teal-500",
    chip: "bg-teal-50 text-teal-700", chipHover: "hover:bg-teal-100",
    chipSelected: "bg-teal-100 text-teal-900 ring-2 ring-teal-300",
    cardBg: "bg-teal-50",
    cardSelected: "border-teal-500 ring-4 ring-teal-200",
    cardSelectedDot: "bg-teal-500", text: "text-teal-700",
    buttonBg: "bg-teal-600", buttonHoverBg: "hover:bg-teal-700",
  },
};

const FALLBACK = MAP.slate;

export function colorClasses(token: string | null | undefined): ColorClasses {
  if (!token) return FALLBACK;
  return MAP[token as ColorToken] ?? FALLBACK;
}

export function isValidColor(token: string | null | undefined): boolean {
  if (!token) return false;
  return token in MAP;
}
