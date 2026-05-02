"use client";
import { COLOR_TOKENS, colorClasses, type ColorToken } from "@/lib/colors";

export default function ColorPicker({
  value,
  onChange,
  size = "sm",
}: {
  value: string | null;
  onChange: (color: ColorToken | null) => void;
  size?: "sm" | "xs";
}) {
  const dot = size === "xs" ? "h-4 w-4" : "h-5 w-5";
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {COLOR_TOKENS.map((c) => {
        const cc = colorClasses(c);
        const selected = value === c;
        return (
          <button
            key={c}
            type="button"
            onClick={() => onChange(selected ? null : c)}
            title={c}
            aria-label={`color ${c}${selected ? " (selected)" : ""}`}
            className={`${dot} rounded-full ${cc.dot} ${selected ? "ring-2 ring-offset-2 ring-slate-400" : "opacity-70 hover:opacity-100"}`}
          />
        );
      })}
    </div>
  );
}
