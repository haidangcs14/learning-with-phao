/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { ActivityHeatmap } from "@/components/activity-heatmap";
import { ChallengeCard, ContinueCard, EfficiencyCard } from "@/components/dashboard/cards";
import { LeaderboardCard } from "@/components/dashboard/leaderboard-card";
import { MonthlyCalendar } from "@/components/dashboard/monthly-calendar";
import { StatTile } from "@/components/dashboard/stat-tile";
import { useHeat } from "@/components/dashboard/use-heat";
import { Protected } from "@/components/protected";
import { Spinner } from "@/components/ui";
import { useGet } from "@/hooks/api";
import { useT } from "@/lib/i18n";
import { displayName, levelTitle } from "@/lib/level";
import { useAuth } from "@/store/auth-store";

interface Xp { total_xp: number; by_source: Record<string, number>; level: number; xp_into_level: number; xp_for_next: number; rank: number | null }

function Dashboard() {
  const t = useT();
  const user = useAuth((s) => s.user);
  const xp = useGet<Xp>("/leaderboard/me");
  const fc = useGet<{ by_status: Record<string, number>; due: number }>("/flashcards/stats");
  const heat = useHeat();
  if (xp.isLoading || fc.isLoading) return <Spinner />;
  const x = xp.data?.data;
  const streak = heat.data?.data.current_streak ?? 0;
  const bySource = x?.by_source ?? {};
  const mood = streak >= 2 ? t("Bạn đang có chuỗi {n} ngày! 🔥 Hãy giữ lửa nhé!", { n: streak }) : streak === 1 ? t("Đã bắt đầu chuỗi mới! Hãy quay lại vào ngày mai nhé 🔥") : t("Học vài từ hôm nay để bắt đầu chuỗi mới nhé!");
  return (
    <div className="mx-auto max-w-[88rem] px-4 py-6 sm:px-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-6">
          <div className="flex flex-wrap items-center gap-4">
            <h1 className="text-balance text-3xl font-bold sm:text-4xl">{t("Xin chào, {name}!", { name: user ? displayName(user) : "" })}</h1>
            <div className="flex min-w-0 flex-1 items-center gap-3 sm:min-w-72">
              <img src="/cute.gif" alt="" className="h-16 w-16 shrink-0 rounded-full border-2 border-border bg-accent-soft object-cover shadow-raised" />
              <p className="relative min-w-0 flex-1 rounded-card bg-accent-soft px-4 py-3 text-sm font-semibold leading-snug text-pretty before:absolute before:-left-1.5 before:top-1/2 before:h-3 before:w-3 before:-translate-y-1/2 before:rotate-45 before:bg-accent-soft">{mood}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile value={String(x?.total_xp ?? 0)} label={t("XP hiện tại")} emoji="🪙" tone="accent" />
            <StatTile value={`Lv.${x?.level ?? 1}`} label={t(levelTitle(x?.level ?? 1))} emoji="💎" tone="secondary">
              <div className="h-2 overflow-hidden rounded-full bg-surface/70" role="progressbar" aria-valuenow={x?.xp_into_level ?? 0} aria-valuemax={x?.xp_for_next ?? 100}><div className="h-full rounded-full bg-primary" style={{ width: `${x ? (x.xp_into_level / x.xp_for_next) * 100 : 0}%` }} /></div>
            </StatTile>
            <StatTile value={t("{n} ngày", { n: streak })} label={t("Chuỗi học")} emoji="🔥" tone="primary" />
            <StatTile value={x?.rank ? `#${x.rank}` : "—"} label={t("Hạng")} emoji="🏆" tone="error" />
          </div>

          <ContinueCard />
          <div className="grid gap-6 md:grid-cols-2"><ChallengeCard /><EfficiencyCard due={fc.data?.data.due ?? 0} /></div>
        </div>

        <div className="space-y-6"><MonthlyCalendar /><LeaderboardCard /></div>
      </div>

      <div className="mt-6 space-y-6">
        <ActivityHeatmap />
        <section className="rounded-card border-2 border-border bg-surface p-4 shadow-raised">
          <h2 className="mb-2 font-bold">{t("XP theo hoạt động")}</h2>
          {Object.keys(bySource).length === 0 ? <p className="text-muted-foreground">{t("Chưa có hoạt động nào. Hãy bắt đầu học!")}</p> : (
            <ul className="space-y-1 text-sm">{Object.entries(bySource).map(([k, v]) => <li key={k} className="flex justify-between capitalize"><span>{k}</span><span>{v} XP</span></li>)}</ul>
          )}
        </section>
        <Link href="/flashcards" className="lift inline-block rounded-btn bg-primary px-5 py-2 font-bold text-primary-foreground shadow-raised hover:bg-primary-hover">{t("Tiếp tục học →")}</Link>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return <Protected><Dashboard /></Protected>;
}
