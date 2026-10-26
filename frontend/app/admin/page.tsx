"use client";

import type { ReactNode } from "react";
import { BarChart, DonutChart, LineChart, PALETTE } from "@/components/charts";
import { Card, ErrorBox, Page, Spinner } from "@/components/ui";
import { useGet } from "@/hooks/api";
import { useT } from "@/lib/i18n";
import type { AdminStats } from "@/types";

function Panel({ title, children, wide = false }: { title: string; children: ReactNode; wide?: boolean }) {
  return <Card className={`space-y-2 ${wide ? "lg:col-span-2" : ""}`}><h2 className="font-semibold">{title}</h2>{children}</Card>;
}

export default function AdminDashboard() {
  const t = useT();
  const q = useGet<AdminStats>("/admin/stats");
  if (q.isLoading) return <Spinner />;
  if (!q.data) return <div className="p-6"><ErrorBox error={q.error} /></div>;
  const s = q.data.data;
  const items: [string, number][] = [["Người dùng", s.users], ["Mới (7 ngày)", s.new_users_7d], ["Hoạt động hôm nay", s.active_users_today],
    ["Từ vựng", s.words], ["Câu hỏi", s.questions], ["Lượt quiz", s.quiz_attempts], ["Lượt game", s.games_played], ["Bài speaking", s.speaking_sessions]];
  const days = s.series.dates;
  return (
    <Page title="Admin Dashboard">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {items.map(([l, v]) => <Card key={l}><p className="text-sm text-slate-500">{t(l)}</p><p className="text-2xl font-bold">{v}</p></Card>)}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel wide title={t("Hoạt động 14 ngày gần nhất")}>
          <LineChart label={t("Hoạt động 14 ngày gần nhất")} labels={days} series={[
            { name: t("Người dùng mới"), color: PALETTE[0] as string, values: s.series.new_users },
            { name: t("Người dùng hoạt động"), color: PALETTE[1] as string, values: s.series.active_users },
            { name: t("Lượt hoạt động"), color: PALETTE[2] as string, values: s.series.events }]} />
        </Panel>
        <Panel title={t("Lượt hoạt động mỗi ngày")}><BarChart label={t("Lượt hoạt động mỗi ngày")} data={days.map((d, i) => ({ label: d, value: s.series.events[i] ?? 0 }))} color={PALETTE[2] as string} /></Panel>
        <Panel title={t("Người dùng theo cấp độ")}><BarChart label={t("Người dùng theo cấp độ")} data={s.users_by_level} color={PALETTE[3] as string} /></Panel>
        <Panel title={t("XP theo hoạt động")}><DonutChart label={t("XP theo hoạt động")} data={s.xp_by_source} /></Panel>
        <Panel title={t("Vai trò người dùng")}><DonutChart label={t("Vai trò người dùng")} data={s.users_by_role} /></Panel>
        <Panel title={t("Từ vựng theo chủ đề (top 10)")}><BarChart horizontal label={t("Từ vựng theo chủ đề (top 10)")} data={s.words_by_topic} color={PALETTE[5] as string} /></Panel>
        <Panel title={t("Từ vựng theo trình độ")}><DonutChart label={t("Từ vựng theo trình độ")} data={s.words_by_level} /></Panel>
      </div>
    </Page>
  );
}
