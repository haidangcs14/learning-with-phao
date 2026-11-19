"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import { useLang } from "@/store/lang-store";

export interface RoadLesson { id: string; title: string; slug: string; level: string; description: string; en?: { description?: string } }
export interface RoadStep { l: RoadLesson; stage: number }

// Vietnamese text is the translation key (English in lib/i18n.ts). Classes are written out in full so Tailwind can see them.
export const STAGES = [
  { key: "present", label: "Thì hiện tại", fill: "fill-primary", fg: "fill-primary-foreground", text: "text-primary-text", hover: "hover:border-primary" },
  { key: "past", label: "Thì quá khứ", fill: "fill-secondary", fg: "fill-secondary-foreground", text: "text-secondary-text", hover: "hover:border-secondary" },
  { key: "future", label: "Thì tương lai", fill: "fill-accent", fg: "fill-accent-foreground", text: "text-accent-text", hover: "hover:border-accent" },
  { key: "other", label: "Cấu trúc & chủ đề khác", fill: "fill-secondary-hover", fg: "fill-secondary-foreground", text: "text-secondary-text", hover: "hover:border-secondary-hover" },
] as const;

const HEAD = 112, FOOT = 130, GAP = 56; // flag area, trophy area, space between two lessons (px)

interface Geo { y: number; edge: number }
const sameGeo = (a: Geo[], b: Geo[]) => a.length === b.length && a.every((g, i) => g.y === b[i]?.y && g.edge === b[i]?.edge);

/** A winding dashed path from the flag down to the trophy, with the lessons hanging off it on alternating sides.
 *  The cards are ordinary content (auto height, nothing clipped); their real positions are measured, so the path always meets them
 *  whatever the text length or screen width. On phones the path runs down the left edge and the cards sit to its right. */
export function Roadmap({ steps, visited, next }: { steps: RoadStep[]; visited: Set<string>; next: number }) {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const box = useRef<HTMLDivElement>(null);
  const cards = useRef<(HTMLAnchorElement | null)[]>([]);
  const [W, setW] = useState(0);
  const [H, setH] = useState(0);
  const [geo, setGeo] = useState<Geo[]>([]);
  const n = steps.length;
  const narrow = W > 0 && W < 640;

  const measure = useCallback(() => {
    const el = box.current;
    if (!el) return;
    const b = el.getBoundingClientRect(), nw = Math.round(b.width), nh = Math.round(b.height), isNarrow = nw < 640;
    const g = steps.map((_, i) => {
      const c = cards.current[i];
      if (!c) return { y: 0, edge: 0 };
      const r = c.getBoundingClientRect();
      const toRight = !isNarrow && i % 2 === 0; // left-hand cards connect on their right edge
      return { y: Math.round(r.top - b.top + r.height / 2), edge: Math.round(toRight ? r.right - b.left + 4 : r.left - b.left - 4) };
    });
    setW(nw); setH(nh); setGeo((prev) => (sameGeo(prev, g) ? prev : g));
  }, [steps]);

  useLayoutEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (box.current) ro.observe(box.current);
    cards.current.forEach((c) => c && ro.observe(c));
    return () => ro.disconnect();
  }, [measure, n]);
  useEffect(() => { void document.fonts?.ready.then(measure); }, [measure]); // the web font changes line breaks once it has loaded

  const cx = narrow ? 26 : W / 2, amp = narrow ? 6 : 16;
  const px = (i: number) => cx + (i % 2 === 0 ? -amp : amp);
  const flag = { x: narrow ? 26 : Math.max(70, W * 0.2), y: 56 };
  const trophy = { x: cx, y: H - FOOT + 50 };
  const ready = W > 0 && geo.length === n && n > 0 && geo.every((g) => g.y > 0);

  let d = "";
  if (ready) {
    const first = geo[0] as Geo, s0 = { x: narrow ? flag.x : flag.x + 30, y: narrow ? flag.y + 30 : flag.y + 14 };
    d = narrow ? `M ${s0.x},${s0.y} L ${px(0)},${first.y - 40} L ${px(0)},${first.y}`
      : `M ${s0.x},${s0.y} C ${s0.x + 110},${s0.y - 6} ${px(0)},${first.y - 110} ${px(0)},${first.y}`;
    for (let i = 0; i < n - 1; i++) { const a = (geo[i] as Geo).y, c = (geo[i + 1] as Geo).y, m = (a + c) / 2; d += ` C ${px(i)},${m} ${px(i + 1)},${m} ${px(i + 1)},${c}`; }
    const last = (geo[n - 1] as Geo).y, m = (last + trophy.y) / 2;
    d += ` C ${px(n - 1)},${m} ${trophy.x},${m} ${trophy.x},${trophy.y - 30}`;
  }
  const lastSeen = steps.reduce((acc, s, i) => (visited.has(s.l.slug) ? i : acc), -1);
  const progressY = ready && lastSeen >= 0 ? (geo[lastSeen] as Geo).y + 28 : 0;

  return (
    <div ref={box} className="relative">
      {ready && (
        <svg width={W} height={H} className="pointer-events-none absolute inset-0 z-0" aria-hidden="true">
          <defs><clipPath id="grammar-progress"><rect x="0" y="0" width={W} height={progressY} /></clipPath></defs>
          <path d={d} className="fill-none stroke-input" strokeWidth="3" strokeDasharray="9 9" strokeLinecap="round" />
          <path d={d} className="fill-none stroke-primary" strokeWidth="4" strokeDasharray="9 9" strokeLinecap="round" clipPath="url(#grammar-progress)" />
          {steps.map(({ l, stage }, i) => {
            const g = geo[i] as Geo, st = STAGES[stage] ?? STAGES[3], seen = visited.has(l.slug);
            return (
              <g key={l.id}>
                <line x1={px(i)} y1={g.y} x2={g.edge} y2={g.y} className="stroke-input" strokeWidth="2.5" strokeDasharray="4 6" strokeLinecap="round" />
                {i === next && <circle cx={px(i)} cy={g.y} r="22" className="animate-pulse fill-none stroke-accent" strokeWidth="3" />}
                <circle cx={px(i)} cy={g.y} r="16" className={`${seen ? "fill-success" : st.fill} stroke-background`} strokeWidth="3" />
                <text x={px(i)} y={g.y} textAnchor="middle" dominantBaseline="central" className={`${seen ? "fill-success-foreground" : st.fg} text-[13px] font-bold`}>{seen ? "✓" : i + 1}</text>
              </g>
            );
          })}
        </svg>
      )}

      <div className="relative z-10" style={{ height: HEAD }}>
        <div className="absolute flex flex-col items-center" style={{ left: flag.x - (narrow ? 26 : 32), top: flag.y - (narrow ? 26 : 32) }}>
          <span className={`flex items-center justify-center rounded-full border-2 border-input bg-surface shadow-raised ${narrow ? "h-[52px] w-[52px] text-2xl" : "h-16 w-16 text-3xl"}`} aria-hidden="true">🚩</span>
          <span className="mt-1 whitespace-nowrap text-xs font-bold text-muted-foreground">{t("Bắt đầu")}</span>
        </div>
      </div>

      <ol className="relative z-10" style={{ display: "flex", flexDirection: "column", gap: GAP }}>
        {steps.map(({ l, stage }, i) => {
          const left = !narrow && i % 2 === 0, st = STAGES[stage] ?? STAGES[3];
          const first = i === 0 || steps[i - 1]?.stage !== stage, seen = visited.has(l.slug);
          return (
            <li key={l.id} className={narrow ? "pl-14" : "grid grid-cols-2"}>
              <div className={narrow ? "" : left ? "col-start-1 pr-14 lg:pr-16" : "col-start-2 pl-14 lg:pl-16"}>
                {first && <p className={`mb-2 text-balance text-sm font-bold leading-snug ${st.text} ${!narrow && !left ? "text-right" : ""}`}>{t("Giai đoạn {n}", { n: stage + 1 })} · {t(st.label)}</p>}
                <Link href={`/grammar/${l.slug}`} ref={(el) => { cards.current[i] = el; }}
                  className={`lift block rounded-card border-2 bg-surface px-4 py-4 shadow-raised transition hover:shadow-raised-hover sm:px-5 ${i === next ? "border-accent" : `border-border ${st.hover}`}`}>
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-bold text-primary-text">{l.level}</span>
                    {i === next && <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-bold text-accent-foreground">{t("Tiếp theo")}</span>}
                    {seen && <span className="text-xs font-semibold text-success-text">✓ {t("Đã xem")}</span>}
                  </span>
                  <span className="mt-2 block text-balance text-lg font-bold leading-snug [overflow-wrap:anywhere]">{l.title}</span>
                  <span className="mt-1.5 block text-pretty text-sm leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">{lang === "en" ? l.en?.description ?? l.description : l.description}</span>
                </Link>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="relative z-10" style={{ height: FOOT }}>
        <div className="absolute flex flex-col items-center" style={{ left: trophy.x - 28, top: 22 }}>
          <span className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-input bg-surface text-2xl shadow-raised" aria-hidden="true">🏆</span>
          <span className="mt-1 whitespace-nowrap text-xs font-bold text-muted-foreground">{t("Hoàn thành lộ trình")}</span>
        </div>
      </div>
    </div>
  );
}
