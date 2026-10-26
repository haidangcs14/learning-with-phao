"use client";

import { useState } from "react";

export const PALETTE = ["#4f46e5", "#06b6d4", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#ec4899", "#64748b"];
export interface Datum { label: string; value: number }
const axis = "fill-slate-500 text-[10px]";

function nice(max: number): number {
  if (max <= 5) return 5;
  const pow = 10 ** Math.floor(Math.log10(max));
  return Math.ceil(max / pow) * pow;
}

/** Several lines over the same x labels (e.g. the last 14 days). */
export function LineChart({ labels, series, label }: { labels: string[]; series: { name: string; color: string; values: number[] }[]; label: string }) {
  const W = 600, H = 230, L = 34, R = 12, T = 12, B = 28;
  const top = nice(Math.max(1, ...series.flatMap((s) => s.values)));
  const x = (i: number) => L + (i * (W - L - R)) / Math.max(1, labels.length - 1);
  const y = (v: number) => T + (1 - v / top) * (H - T - B);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="w-full">
        {[0, 0.25, 0.5, 0.75, 1].map((p) => (
          <g key={p}><line x1={L} x2={W - R} y1={y(top * p)} y2={y(top * p)} className="stroke-slate-200 dark:stroke-slate-800" /><text x={L - 6} y={y(top * p) + 3} textAnchor="end" className={axis}>{Math.round(top * p)}</text></g>
        ))}
        {labels.map((d, i) => (i % 2 === 0 || i === labels.length - 1) && <text key={d} x={x(i)} y={H - 8} textAnchor="middle" className={axis}>{d.slice(5)}</text>)}
        {series.map((s) => (
          <g key={s.name}>
            <polyline fill="none" stroke={s.color} strokeWidth="2.5" strokeLinejoin="round" points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")} />
            {s.values.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r="3" fill={s.color}><title>{`${s.name} · ${labels[i]}: ${v}`}</title></circle>)}
          </g>
        ))}
      </svg>
      <Legend items={series.map((s) => ({ label: s.name, color: s.color }))} />
    </div>
  );
}

/** Vertical bars, or horizontal bars for long labels. */
export function BarChart({ data, color = PALETTE[0] as string, horizontal = false, label }: { data: Datum[]; color?: string; horizontal?: boolean; label: string }) {
  const top = nice(Math.max(1, ...data.map((d) => d.value)));
  if (horizontal) {
    return (
      <ul role="img" aria-label={label} className="space-y-1.5 text-sm">
        {data.map((d) => (
          <li key={d.label} className="grid grid-cols-[minmax(0,9rem)_1fr_2.5rem] items-center gap-2">
            <span className="truncate text-slate-600 dark:text-slate-300" title={d.label}>{d.label}</span>
            <span className="h-3 overflow-hidden rounded bg-slate-100 dark:bg-slate-800"><span className="block h-full rounded" style={{ width: `${(d.value / top) * 100}%`, background: color }} /></span>
            <b className="text-right">{d.value}</b>
          </li>
        ))}
      </ul>
    );
  }
  const W = 600, H = 220, L = 30, B = 26, T = 16, slot = (W - L - 8) / Math.max(1, data.length);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="w-full">
      {[0, 0.5, 1].map((p) => <g key={p}><line x1={L} x2={W - 8} y1={T + (1 - p) * (H - T - B)} y2={T + (1 - p) * (H - T - B)} className="stroke-slate-200 dark:stroke-slate-800" /><text x={L - 5} y={T + (1 - p) * (H - T - B) + 3} textAnchor="end" className={axis}>{Math.round(top * p)}</text></g>)}
      {data.map((d, i) => {
        const h = (d.value / top) * (H - T - B);
        return (
          <g key={d.label}>
            <rect x={L + i * slot + slot * 0.18} y={H - B - h} width={slot * 0.64} height={Math.max(h, 0)} rx="3" fill={color}><title>{`${d.label}: ${d.value}`}</title></rect>
            {d.value > 0 && <text x={L + i * slot + slot / 2} y={H - B - h - 4} textAnchor="middle" className={axis}>{d.value}</text>}
            {(data.length <= 8 || i % 2 === 0) && <text x={L + i * slot + slot / 2} y={H - 8} textAnchor="middle" className={axis}>{d.label.length > 6 && /^\d{4}-/.test(d.label) ? d.label.slice(5) : d.label}</text>}
          </g>
        );
      })}
    </svg>
  );
}

/** Donut with a legend; hovering a legend row highlights its slice. */
export function DonutChart({ data, label }: { data: Datum[]; label: string }) {
  const [hot, setHot] = useState<number | null>(null);
  const total = data.reduce((s, d) => s + d.value, 0);
  const R = 52, C = 2 * Math.PI * R;
  let offset = 0;
  if (total === 0) return <p className="py-8 text-center text-sm text-slate-500">—</p>;
  return (
    <div className="flex flex-wrap items-center justify-center gap-4">
      <svg viewBox="0 0 140 140" role="img" aria-label={label} className="h-36 w-36 -rotate-90">
        {data.map((d, i) => {
          const len = (d.value / total) * C;
          const el = <circle key={d.label} cx="70" cy="70" r={R} fill="none" stroke={PALETTE[i % PALETTE.length]} strokeWidth={hot === i ? 24 : 20} strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offset}><title>{`${d.label}: ${d.value}`}</title></circle>;
          offset += len;
          return el;
        })}
        <text x="70" y="70" textAnchor="middle" dominantBaseline="middle" transform="rotate(90 70 70)" className="fill-slate-900 text-xl font-bold dark:fill-slate-100">{total}</text>
      </svg>
      <ul className="space-y-1 text-sm">
        {data.map((d, i) => (
          <li key={d.label} onMouseEnter={() => setHot(i)} onMouseLeave={() => setHot(null)} className="flex items-center gap-2">
            <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: PALETTE[i % PALETTE.length] }} />
            <span className="max-w-32 truncate" title={d.label}>{d.label}</span><b>{d.value}</b><span className="text-xs text-slate-500">{Math.round((d.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Legend({ items }: { items: { label: string; color: string }[] }) {
  return <ul className="mt-1 flex flex-wrap justify-center gap-4 text-xs">{items.map((i) => <li key={i.label} className="flex items-center gap-1.5"><span className="h-2 w-4 rounded" style={{ background: i.color }} />{i.label}</li>)}</ul>;
}
