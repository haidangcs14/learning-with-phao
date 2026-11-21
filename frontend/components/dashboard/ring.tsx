/** Donut chart: the percentage in the middle, colours from the design tokens. */
export function Ring({ value, size = 120, label }: { value: number; size?: number; label: string }) {
  const r = (size - 16) / 2, c = 2 * Math.PI * r, v = Math.max(0, Math.min(100, value));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`${label}: ${v}%`}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} className="fill-none stroke-border" strokeWidth="14" />
        <circle cx={size / 2} cy={size / 2} r={r} className="fill-none stroke-primary transition-all duration-700" strokeWidth="14" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-2xl font-bold">{v}%</span>
    </div>
  );
}
