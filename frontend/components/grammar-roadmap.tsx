"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
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

const ROW = 160, CARD_H = 108, TOP = 120, LABEL = 26;

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth);
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/** A winding dashed path from the flag down to the trophy. The lessons hang off it on alternating sides, with a "Stage n" label
 *  above the first lesson of every stage. On phones the path runs down the left edge and the cards sit to its right. */
export function Roadmap({ steps, visited, next }: { steps: RoadStep[]; visited: Set<string>; next: number }) {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const [ref, W] = useWidth();
  const n = steps.length;
  const narrow = W < 640;
  const cx = narrow ? 26 : W / 2, amp = narrow ? 6 : 16;
  const cardW = narrow ? W - 58 : Math.max(220, W / 2 - 64);
  const px = (i: number) => cx + (i % 2 === 0 ? -amp : amp);
  const py = (i: number) => TOP + i * ROW + ROW / 2;
  const H = TOP + n * ROW + 130;
  const flag = { x: narrow ? 26 : Math.max(70, W * 0.2), y: 56 };
  const trophy = { x: cx, y: TOP + n * ROW + 50 };

  const s0 = { x: narrow ? flag.x : flag.x + 30, y: narrow ? flag.y + 32 : flag.y + 14 };
  let d = narrow ? `M ${s0.x},${s0.y} L ${px(0)},${py(0) - 40} L ${px(0)},${py(0)}`
    : `M ${s0.x},${s0.y} C ${s0.x + 110},${s0.y - 6} ${px(0)},${py(0) - 110} ${px(0)},${py(0)}`;
  for (let i = 0; i < n - 1; i++) { const m = (py(i) + py(i + 1)) / 2; d += ` C ${px(i)},${m} ${px(i + 1)},${m} ${px(i + 1)},${py(i + 1)}`; }
  if (n > 0) { const m = (py(n - 1) + trophy.y) / 2; d += ` C ${px(n - 1)},${m} ${trophy.x},${m} ${trophy.x},${trophy.y - 30}`; }
  const lastSeen = steps.reduce((acc, s, i) => (visited.has(s.l.slug) ? i : acc), -1);
  const progressY = lastSeen >= 0 ? py(lastSeen) + 24 : 0;

  if (W === 0) return <div ref={ref} style={{ minHeight: 400 }} />;
  return (
    <div ref={ref} className="relative" style={{ height: H }}>
      <svg width={W} height={H} className="absolute inset-0" aria-hidden="true">
        <defs><clipPath id="grammar-progress"><rect x="0" y="0" width={W} height={progressY} /></clipPath></defs>
        <path d={d} className="fill-none stroke-input" strokeWidth="3" strokeDasharray="9 9" strokeLinecap="round" />
        <path d={d} className="fill-none stroke-primary" strokeWidth="4" strokeDasharray="9 9" strokeLinecap="round" clipPath="url(#grammar-progress)" />
        {steps.map(({ l, stage }, i) => {
          const left = !narrow && i % 2 === 0;
          const edge = narrow ? 52 : left ? cardW + 4 : W - cardW - 4;
          const st = STAGES[stage] ?? STAGES[3];
          const seen = visited.has(l.slug);
          return (
            <g key={l.id}>
              <line x1={px(i)} y1={py(i)} x2={edge} y2={py(i)} className="stroke-input" strokeWidth="2.5" strokeDasharray="4 6" strokeLinecap="round" />
              {i === next && <circle cx={px(i)} cy={py(i)} r="22" className="animate-pulse fill-none stroke-accent" strokeWidth="3" />}
              <circle cx={px(i)} cy={py(i)} r="16" className={`${seen ? "fill-success" : st.fill} stroke-background`} strokeWidth="3" />
              <text x={px(i)} y={py(i)} textAnchor="middle" dominantBaseline="central" className={`${seen ? "fill-success-foreground" : st.fg} text-[13px] font-bold`}>{seen ? "✓" : i + 1}</text>
            </g>
          );
        })}
      </svg>

      <div className="absolute flex flex-col items-center" style={{ left: flag.x - 32, top: flag.y - 32 }}>
        <span className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-input bg-surface text-3xl shadow-raised" aria-hidden="true">🚩</span>
        <span className="mt-1 text-xs font-bold text-muted-foreground">{t("Bắt đầu")}</span>
      </div>

      <ol className="contents">
        {steps.map(({ l, stage }, i) => {
          const left = !narrow && i % 2 === 0, st = STAGES[stage] ?? STAGES[3];
          const x = narrow ? 56 : left ? 0 : W - cardW;
          const firstOfStage = i === 0 || steps[i - 1]?.stage !== stage;
          const seen = visited.has(l.slug);
          return (
            <li key={l.id} className="absolute" style={{ top: py(i) - CARD_H / 2 - LABEL, left: x, width: cardW, paddingTop: LABEL }}>
              {firstOfStage && <p className={`absolute inset-x-0 top-0 truncate text-sm font-bold ${st.text} ${!narrow && !left ? "text-right" : ""}`}>{t("Giai đoạn {n}", { n: stage + 1 })} · {t(st.label)}</p>}
              <Link href={`/grammar/${l.slug}`} className={`lift block overflow-hidden rounded-card border-2 border-border bg-surface p-3 shadow-raised transition hover:shadow-raised-hover ${st.hover} ${i === next ? "border-accent" : ""}`} style={{ height: CARD_H }}>
                <span className="flex items-center gap-2">
                  <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-bold text-primary-text">{l.level}</span>
                  {i === next && <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-accent-foreground">{t("Tiếp theo")}</span>}
                  {seen && <span className="text-xs font-semibold text-success-text">✓ {t("Đã xem")}</span>}
                </span>
                <span className="mt-1 block truncate text-lg font-bold">{l.title}</span>
                <span className="line-clamp-2 block text-sm text-muted-foreground">{lang === "en" ? l.en?.description ?? l.description : l.description}</span>
              </Link>
            </li>
          );
        })}
      </ol>

      <div className="absolute flex flex-col items-center" style={{ left: trophy.x - 28, top: trophy.y - 28 }}>
        <span className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-input bg-surface text-2xl shadow-raised" aria-hidden="true">🏆</span>
        <span className="mt-1 whitespace-nowrap text-xs font-bold text-muted-foreground">{t("Hoàn thành lộ trình")}</span>
      </div>
    </div>
  );
}
