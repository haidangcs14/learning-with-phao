"use client";

export interface Rule { label: string; ok: boolean; touched: boolean }

/** Condition box: grey until the field is touched, then green ✓ when satisfied and brick-red ✗ when not. */
export function Checklist({ title, rules }: { title: string; rules: Rule[] }) {
  return (
    <div className="rounded-xl border border-border bg-surface-secondary p-3" aria-live="polite">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <ul className="space-y-1 text-sm">
        {rules.map((r) => {
          const tone = !r.touched ? "text-muted-foreground"
            : r.ok ? "text-success-text" : "text-error-text ";
          return (
            <li key={r.label} className={`flex items-center gap-2 transition-colors ${tone}`}>
              <span aria-hidden="true" className="w-4 text-center font-bold">{!r.touched ? "○" : r.ok ? "✓" : "✗"}</span>
              <span>{r.label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
