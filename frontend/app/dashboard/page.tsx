"use client";

import Link from "next/link";
import { ActivityHeatmap } from "@/components/activity-heatmap";
import { Avatar } from "@/components/avatar";
import { Protected } from "@/components/protected";
import { Card, Page, Spinner } from "@/components/ui";
import { useGet } from "@/hooks/api";
import { useT } from "@/lib/i18n";
import { useAuth } from "@/store/auth-store";

function Dashboard() {
  const t = useT();
  const user = useAuth((s) => s.user);
  const xp = useGet<{ total_xp: number; by_source: Record<string, number>; level: number; xp_into_level: number; xp_for_next: number }>("/leaderboard/me");
  const me = useAuth((s) => s.user);
  const fc = useGet<{ by_status: Record<string, number>; due: number }>("/flashcards/stats");
  if (xp.isLoading || fc.isLoading) return <Spinner />;
  const bySource = xp.data?.data.by_source ?? {};
  return (
    <Page title={t("Xin chào, {name}!", { name: user?.username ?? "" })}>
      {xp.data && (
        <Card className="flex items-center gap-4">
          {me && <Avatar user={me} size={56} />}
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Lv.{xp.data.data.level} <span className="text-sm font-normal text-slate-500">· {t("Tổng XP")}: {xp.data.data.total_xp}</span></p>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"><div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${(xp.data.data.xp_into_level / xp.data.data.xp_for_next) * 100}%` }} /></div>
            <p className="mt-1 text-xs text-slate-500">{t("{a}/{b} XP đến cấp tiếp theo", { a: xp.data.data.xp_into_level, b: xp.data.data.xp_for_next })}</p>
          </div>
          <Link href="/profile" className="shrink-0 text-sm text-indigo-600">{t("Hồ sơ cá nhân")}</Link>
        </Card>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card><p className="text-sm text-slate-500">{t("Tổng XP")}</p><p className="text-3xl font-bold">⭐ {xp.data?.data.total_xp ?? 0}</p></Card>
        <Card><p className="text-sm text-slate-500">{t("Thẻ cần ôn hôm nay")}</p><p className="text-3xl font-bold">{fc.data?.data.due ?? 0}</p></Card>
        <Card><p className="text-sm text-slate-500">{t("Từ đã thuộc")}</p><p className="text-3xl font-bold">{fc.data?.data.by_status.learned ?? 0}</p></Card>
      </div>
      <ActivityHeatmap />
      <Card>
        <h2 className="mb-2 font-semibold">{t("XP theo hoạt động")}</h2>
        {Object.keys(bySource).length === 0 ? <p className="text-slate-500">{t("Chưa có hoạt động nào. Hãy bắt đầu học!")}</p> : (
          <ul className="space-y-1 text-sm">{Object.entries(bySource).map(([k, v]) => <li key={k} className="flex justify-between capitalize"><span>{k}</span><span>{v} XP</span></li>)}</ul>
        )}
      </Card>
      <Link href="/flashcards" className="inline-block rounded-lg bg-indigo-600 px-5 py-2 text-white">{t("Tiếp tục học →")}</Link>
    </Page>
  );
}

export default function DashboardPage() {
  return <Protected><Dashboard /></Protected>;
}
