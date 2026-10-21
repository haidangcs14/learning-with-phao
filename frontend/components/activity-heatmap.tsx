"use client";

import { useEffect, useMemo, useRef } from "react";
import { useGet } from "@/hooks/api";
import { useT } from "@/lib/i18n";
import { useLang } from "@/store/lang-store";
import { Card, ErrorBox, Spinner } from "@/components/ui";

interface Day { date: string; count: number; xp: number; level: 0 | 1 | 2 | 3 | 4 }
interface Heat { days: Day[]; current_streak: number; longest_streak: number; active_days: number; total: number }

const LEVEL = [
  "bg-slate-200 dark:bg-slate-800", "bg-emerald-200 dark:bg-emerald-900", "bg-emerald-400 dark:bg-emerald-700",
  "bg-emerald-500 dark:bg-emerald-500", "bg-emerald-700 dark:bg-emerald-300",
];
const parse = (d: string) => new Date(`${d}T00:00:00`);

export function ActivityHeatmap() {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const locale = lang === "en" ? "en-US" : "vi-VN";
  const tz = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", []);
  const q = useGet<Heat>(`/activity/heatmap?days=365&tz=${encodeURIComponent(tz)}`);
  const scroller = useRef<HTMLDivElement>(null);
  const data = q.data?.data;

  // GitHub layout: one column per week (Sun..Sat), padded at the start so weekdays line up
  const weeks = useMemo(() => {
    const first = data?.days[0];
    if (!data || !first) return [];
    const cells: (Day | null)[] = [...Array<null>(parse(first.date).getDay()).fill(null), ...data.days];
    const out: (Day | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) out.push(cells.slice(i, i + 7));
    return out;
  }, [data]);

  useEffect(() => { if (scroller.current) scroller.current.scrollLeft = scroller.current.scrollWidth; }, [weeks]);

  if (q.isLoading) return <Spinner />;
  if (!data) return <ErrorBox error={q.error} />;

  let prevMonth = -1;
  const monthLabels = weeks.map((w) => {
    const d = w.find((c): c is Day => !!c);
    const m = d ? parse(d.date).getMonth() : prevMonth;
    const show = d && m !== prevMonth && parse(d.date).getDate() <= 7;
    if (d) prevMonth = m;
    return show && d ? parse(d.date).toLocaleDateString(locale, { month: "short" }) : "";
  });
  const dayLabels = [1, 3, 5].map((i) => new Date(2024, 0, 7 + i).toLocaleDateString(locale, { weekday: "short" }));

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">{t("Mức độ chăm chỉ (365 ngày)")}</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">{t("{n} hoạt động trong năm qua", { n: data.total })}</p>
      </div>
      <div className="flex gap-2">
        <div className="flex flex-col pt-[18px] text-[10px] text-slate-500" aria-hidden="true">
          {[0, 1, 2, 3, 4, 5, 6].map((r) => <span key={r} className="h-3 leading-3" style={{ marginTop: r === 0 ? 0 : 3 }}>{r % 2 === 1 ? dayLabels[(r - 1) / 2] : ""}</span>)}
        </div>
        <div ref={scroller} className="overflow-x-auto pb-1">
          <div className="flex gap-[3px]">
            {weeks.map((w, wi) => (
              <div key={wi} className="flex flex-col gap-[3px]">
                <span className="h-[15px] whitespace-nowrap text-[10px] leading-[15px] text-slate-500">{monthLabels[wi]}</span>
                {w.map((d, di) => d ? (
                  <div key={d.date} className={`h-3 w-3 rounded-[3px] ${LEVEL[d.level]}`}
                    title={t("{n} hoạt động · {xp} XP · {date}", { n: d.count, xp: d.xp, date: parse(d.date).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" }) })} />
                ) : <div key={`e${di}`} className="h-3 w-3" />)}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="flex gap-4">
          <span>🔥 <b>{data.current_streak}</b> {t("ngày liên tiếp")}</span>
          <span>🏅 {t("Dài nhất")}: <b>{data.longest_streak}</b></span>
          <span>📅 {t("Ngày học")}: <b>{data.active_days}</b></span>
        </div>
        <div className="flex items-center gap-1 text-xs text-slate-500">
          {t("Ít")} {LEVEL.map((c, i) => <span key={i} className={`h-3 w-3 rounded-[3px] ${c}`} />)} {t("Nhiều")}
        </div>
      </div>
    </Card>
  );
}
