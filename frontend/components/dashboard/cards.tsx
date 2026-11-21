"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Ring } from "@/components/dashboard/ring";
import { useHeat } from "@/components/dashboard/use-heat";
import { useGet } from "@/hooks/api";
import { useT } from "@/lib/i18n";

const play = "lift flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-2xl text-primary-foreground shadow-raised hover:bg-primary-hover";
const card = "rounded-card border-2 border-border bg-surface p-4 shadow-raised sm:p-5";

function Bar({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-sm"><span className="font-semibold">{label}</span><span className="shrink-0 text-xs font-semibold text-muted-foreground">{value}%</span></div>
      <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-border" role="progressbar" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}><div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${value}%` }} /></div>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

/** "Continue where you left off": overall vocabulary and grammar progress. */
export function ContinueCard() {
  const t = useT();
  const topics = useGet<{ topic: string; count: number }[]>("/words/topics");
  const progress = useGet<Record<string, number>>("/study/progress");
  const grammar = useGet<{ slug: string }[]>("/grammar?limit=100");
  const [seen, setSeen] = useState(0);
  useEffect(() => { try { setSeen((JSON.parse(localStorage.getItem("grammar.visited") ?? "[]") as string[]).length); } catch { /* ignore */ } }, []);
  const total = (topics.data?.data ?? []).reduce((s, x) => s + x.count, 0), done = Object.values(progress.data?.data ?? {}).reduce((s, n) => s + n, 0);
  const gTotal = grammar.data?.data.length ?? 0, gDone = Math.min(seen, gTotal);
  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
  return (
    <section className={card} aria-label={t("Tiếp tục học")}>
      <h2 className="font-bold">{t("Tiếp tục học")}</h2>
      <p className="text-sm text-muted-foreground">{t("Tiếp tục từ nơi bạn đã dừng lại")}</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)]">
        <div className="flex min-h-40 flex-col justify-between gap-3 rounded-card bg-accent-soft p-4">
          <div><p className="text-lg font-bold leading-snug">{t("Từ vựng thông dụng")}</p><p className="text-xs text-muted-foreground">{t("{n} nhóm chủ đề", { n: topics.data?.data.length ?? 0 })}</p></div>
          <Link href="/vocabulary/builtin" className={`${play} self-center`} aria-label={t("Học ngay")}>▶</Link>
        </div>
        <div className="flex min-w-0 flex-col justify-between gap-4 sm:border-l-2 sm:border-dashed sm:border-border sm:pl-5">
          <Bar label={t("Từ vựng thông dụng")} value={pct(done, total)} hint={`${t("{a}/{b} thẻ đã thuộc", { a: done, b: total })} · ⭐ ${t("+2 XP cho mỗi từ mới")}`} />
          <Bar label={t("Ngữ pháp")} value={pct(gDone, gTotal)} hint={t("Đã xem {a}/{b} bài", { a: gDone, b: gTotal })} />
          <div className="flex flex-wrap justify-end gap-2">
            <Link href="/grammar" className="lift rounded-btn border border-input bg-surface px-4 py-2 text-sm font-bold hover:bg-surface-secondary">{t("Ngữ pháp")}</Link>
            <Link href="/vocabulary/builtin" className="lift rounded-btn bg-primary px-5 py-2 text-sm font-bold text-primary-foreground shadow-raised hover:bg-primary-hover">{t("Tiếp tục")}</Link>
          </div>
        </div>
      </div>
    </section>
  );
}

const GAMES = [["word-guess", "Đoán Từ", "🔤"], ["vocab-rain", "Vocabulary Rain", "🌧️"], ["word-bridge", "Word Bridge", "🌉"], ["matching", "Card Matching", "🃏"], ["fill-blank", "Điền vào chỗ trống", "✏️"]] as const;

/** A different game every day. */
export function ChallengeCard() {
  const t = useT();
  const [slug, name, icon] = GAMES[new Date().getDate() % GAMES.length] ?? GAMES[0];
  return (
    <section className={`${card} relative flex flex-col overflow-hidden`} aria-label={t("Thử thách hôm nay")}>
      <span className="pointer-events-none absolute -right-6 -top-8 h-28 w-28 rounded-full bg-accent-soft" aria-hidden="true" />
      <div className="relative"><h2 className="font-bold">{t("Thử thách hôm nay")}</h2><p className="text-sm text-muted-foreground">{t("Chơi {game} để kiếm XP!", { game: t(name) })}</p></div>
      <div className="relative my-4 flex flex-1 items-center justify-center gap-4">
        <Link href={`/games/${slug}`} className={`${play} h-16 w-16`} aria-label={t("Bắt đầu")}>▶</Link>
        <span className="select-none text-6xl" aria-hidden="true">{icon}</span>
        <span className="select-none text-4xl" aria-hidden="true">🧩</span>
      </div>
      <p className="relative rounded-full border border-border bg-accent-soft/70 px-3 py-1.5 text-center text-xs font-semibold">{t("Cập nhật mỗi ngày · Bỏ lỡ sẽ mất chuỗi")}</p>
    </section>
  );
}

/** Quiz accuracy, how steadily you study and what is waiting for review. */
export function EfficiencyCard({ due }: { due: number }) {
  const t = useT();
  const hist = useGet<{ total: number; correct: number }[]>("/quiz/history?limit=20");
  const heat = useHeat();
  const attempts = hist.data?.data ?? [];
  const total = attempts.reduce((s, a) => s + a.total, 0), right = attempts.reduce((s, a) => s + a.correct, 0);
  const accuracy = total ? Math.round((right / total) * 100) : 0;
  const week = (heat.data?.data.days ?? []).slice(-7).filter((d) => d.count > 0).length;
  const dot = "h-2.5 w-2.5 shrink-0 rounded-full";
  return (
    <section className={card} aria-label={t("Hiệu quả học tập")}>
      <h2 className="font-bold">{t("Hiệu quả học tập")}</h2>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <Ring value={accuracy} label={t("Độ chính xác quiz")} />
        <ul className="min-w-0 flex-1 space-y-2 text-sm">
          <li className="flex items-center gap-2"><span className={`${dot} bg-primary`} /><span className="flex-1">{t("Độ chính xác quiz")}</span><b>{total ? `${accuracy}%` : "—"}</b></li>
          <li className="flex items-center gap-2"><span className={`${dot} bg-accent`} /><span className="flex-1">{t("Ngày học (30 ngày)")}</span><b>{(heat.data?.data.days ?? []).slice(-30).filter((d) => d.count > 0).length}</b></li>
          <li className="flex items-center gap-2"><span className={`${dot} bg-secondary`} /><span className="flex-1">{t("Thẻ cần ôn")}</span><b>{due}</b></li>
        </ul>
      </div>
      <div className="mt-4 border-t-2 border-dashed border-border pt-3 text-sm">
        <p className="font-semibold">{t("Báo cáo tuần")}</p>
        <p className="text-muted-foreground">{t("Bạn đã học {n}/7 ngày trong 7 ngày qua.", { n: week })}</p>
      </div>
    </section>
  );
}
