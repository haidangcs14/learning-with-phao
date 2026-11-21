import type { ReactNode } from "react";

const TONE = { accent: "bg-accent-soft", secondary: "bg-secondary-soft", primary: "bg-primary-soft", error: "bg-error-soft" } as const;

/** A coloured stat card with a big illustration peeking out of the corner. */
export function StatTile({ value, label, emoji, tone, children }: { value: string; label: string; emoji: string; tone: keyof typeof TONE; children?: ReactNode }) {
  return (
    <div className={`relative flex min-h-[8.75rem] flex-col overflow-hidden rounded-card border-2 border-border p-4 shadow-raised transition duration-200 hover:-translate-y-0.5 hover:shadow-raised-hover ${TONE[tone]}`}>
      <p className="relative z-10 text-2xl font-bold leading-tight [overflow-wrap:anywhere]">{value}</p>
      <p className="relative z-10 text-sm font-medium text-foreground/80">{label}</p>
      {children && <div className="relative z-10 mt-2 pr-10">{children}</div>}
      <span className="pointer-events-none absolute -bottom-3 -right-1 -rotate-6 select-none text-6xl opacity-90" aria-hidden="true">{emoji}</span>
    </div>
  );
}
