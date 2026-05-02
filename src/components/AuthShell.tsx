// Two-column auth layout. Left = brand panel (hidden on mobile), right = form.
// Used by /login and /register for visual consistency.
import Logo from "./Logo";

export default function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2">
      {/* Brand panel */}
      <div
        className="hidden lg:flex flex-col justify-between p-12 text-white"
        style={{
          background:
            "linear-gradient(135deg,#0b1020 0%,#1e1b4b 40%,#3730a3 80%,#6366f1 100%)",
        }}
      >
        <Logo className="text-white [&>span:last-child]:text-white" />

        <div>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight">
            Bridge ideas to shipping.
          </h1>
          <p className="mt-4 text-white/80 max-w-md leading-relaxed">
            A lightweight design-thinking workflow. Anyone can drop an idea.
            Tech picks it up, designs it, builds it, ships it. The story stays
            on one card.
          </p>

          <ul className="mt-8 space-y-2 text-sm text-white/80">
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-white/80" /> Idea → Design → Build → Ship
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-white/80" /> Friendly entry point for non-tech teams
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-white/80" /> Comments, attachments, assignees per card
            </li>
          </ul>
        </div>

        <p className="text-xs text-white/50">
          v1 — designed to grow into etasks.
        </p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
