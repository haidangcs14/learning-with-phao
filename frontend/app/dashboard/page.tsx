"use client";

import Link from "next/link";
import { ActivityHeatmap } from "@/components/activity-heatmap";
import { Protected } from "@/components/protected";
import { Card, Page, Spinner } from "@/components/ui";
import { useGet } from "@/hooks/api";
import { useT } from "@/lib/i18n";
import { useAuth } from "@/store/auth-store";

function Dashboard() {
  const t = useT();
  const user = useAuth((s) => s.user);
  const xp = useGet<{ total_xp: number; by_source: Record<string, number> }>("/leaderboard/me");
  const fc = useGet<{ by_status: Record<string, number>; due: number }>("/flashcards/stats");
  if (xp.isLoading || fc.isLoading) return <Spinner />;
  const bySource = xp.data?.data.by_source ?? {};
  return (
    <Page title={t("Xin chào, {name}!", { name: user?.username ?? "" })}>
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
