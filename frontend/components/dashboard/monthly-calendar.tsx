"use client";

import { useState } from "react";
import { useHeat } from "@/components/dashboard/use-heat";
import { useT } from "@/lib/i18n";
import { useLang } from "@/store/lang-store";

const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const WEEK = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"]; // Monday first (translation keys)

/** The month at a glance: the days you studied are filled, today is ringed. */
export function MonthlyCalendar() {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const heat = useHeat();
  const [back, setBack] = useState(0);
  const now = new Date(), view = new Date(now.getFullYear(), now.getMonth() - back, 1);
  const active = new Set((heat.data?.data.days ?? []).filter((d) => d.count > 0).map((d) => d.date));
  const first = (view.getDay() + 6) % 7, count = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate(), today = key(now);
  const cells = [...Array<null>(first).fill(null), ...Array.from({ length: count }, (_, i) => i + 1)];
  const nav = "flex h-8 w-8 items-center justify-center rounded-btn border border-border bg-surface text-sm hover:bg-surface-secondary disabled:cursor-not-allowed disabled:opacity-40";
  return (
    <section className="rounded-card border-2 border-border bg-accent-soft/60 p-4 shadow-raised" aria-label={t("Hoạt động trong tháng")}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-bold">📅 {t("Hoạt động trong tháng")}</h2>
        <div className="flex items-center gap-1.5">
          <button className={nav} onClick={() => setBack(back + 1)} disabled={back >= 12} aria-label={t("Tháng trước")}>‹</button>
          <button className={nav} onClick={() => setBack(back - 1)} disabled={back === 0} aria-label={t("Tháng sau")}>›</button>
        </div>
      </div>
      <p className="mt-1 text-sm font-semibold capitalize text-muted-foreground">{view.toLocaleDateString(lang === "vi" ? "vi-VN" : "en-US", { month: "long", year: "numeric" })}</p>
      <div className="mt-3 grid grid-cols-7 gap-y-1.5 text-center text-sm">
        {WEEK.map((w) => <span key={w} className="text-xs font-bold text-muted-foreground">{t(w)}</span>)}
        {cells.map((d, i) => {
          if (d === null) return <span key={`b${i}`} />;
          const k = key(new Date(view.getFullYear(), view.getMonth(), d)), on = active.has(k), isToday = k === today, future = k > today;
          return (
            <span key={k} title={on ? t("Đã học") : undefined}
              className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full font-semibold ${on ? "bg-primary text-primary-foreground" : future ? "text-muted-foreground/50" : "text-foreground"} ${isToday ? "ring-2 ring-accent ring-offset-2 ring-offset-background" : ""}`}>{d}</span>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs font-medium">
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-primary" />{t("Đã học")}</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full ring-2 ring-accent" />{t("Hôm nay")}</span>
        <span>{t("Chuỗi dài nhất: {n} ngày", { n: heat.data?.data.longest_streak ?? 0 })} 🔥</span>
      </div>
    </section>
  );
}
