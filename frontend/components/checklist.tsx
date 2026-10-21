"use client";

export interface Rule { label: string; ok: boolean; touched: boolean }

/** Condition box: grey until the field is touched, then green ✓ when satisfied and brick-red ✗ when not. */
export function Checklist({ title, rules }: { title: string; rules: Rule[] }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50" aria-live="polite">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{title}</p>
      <ul className="space-y-1 text-sm">
        {rules.map((r) => {
          const tone = !r.touched ? "text-slate-500 dark:text-slate-400"
            : r.ok ? "text-green-600 dark:text-green-400" : "text-[#b5412a] dark:text-[#ef8a74]";
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
