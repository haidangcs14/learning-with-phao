"use client";

import { useState } from "react";
import { Card, Empty, ErrorBox, Page, Spinner, Tabs } from "@/components/ui";
import { useGet } from "@/hooks/api";
import { useT } from "@/lib/i18n";
import { useAuth } from "@/store/auth-store";
import type { LbRow } from "@/types";

const PERIODS = ["daily", "weekly", "monthly", "all"] as const;
const LABEL = { daily: "Hôm nay", weekly: "Tuần", monthly: "Tháng", all: "Mọi lúc" } as const;

export default function LeaderboardPage() {
  const t = useT();
  const me = useAuth((s) => s.user);
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>("weekly");
  const q = useGet<LbRow[]>(`/leaderboard?period=${period}&limit=50`);
  const rows = q.data?.data ?? [];
  return (
    <Page title={t("Bảng xếp hạng")}>
      <Tabs value={period} onChange={setPeriod} options={PERIODS.map((p) => [p, t(LABEL[p])] as const)} />
      {q.isLoading ? <Spinner /> : q.error ? <ErrorBox error={q.error} /> : rows.length === 0 ? <Empty>{t("Chưa có ai trên bảng xếp hạng.")}</Empty> : (
        <Card className="p-0">
          <ul className="divide-y divide-slate-200 dark:divide-slate-800">
            {rows.map((r) => (
              <li key={r.user_id} className={`flex items-center justify-between px-4 py-3 ${r.username === me?.username ? "bg-indigo-50 dark:bg-indigo-950" : ""}`}>
                <span><span className="mr-3 inline-block w-8 font-bold">{r.rank <= 3 ? ["🥇", "🥈", "🥉"][r.rank - 1] : `#${r.rank}`}</span>{r.username}<span className="ml-2 rounded bg-indigo-100 px-1.5 py-0.5 text-xs font-semibold text-indigo-800">Lv.{r.level}</span></span>
                <span className="font-semibold">{r.xp} XP</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </Page>
  );
}
