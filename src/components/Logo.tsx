// Brand mark — neutral, modern, no specific company. Easy to swap when this
// merges into etasks (just replace the SVG).
export default function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span
        aria-hidden
        className="h-7 w-7 rounded-lg grid place-items-center text-white text-xs font-bold"
        style={{ background: "linear-gradient(135deg,#6366f1 0%,#8b5cf6 60%,#06b6d4 100%)" }}
      >
        DH
      </span>
      <span className="font-semibold text-brand-ink tracking-tight">Design Hub</span>
    </div>
  );
}
