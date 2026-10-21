"use client";

import { Card, ErrorBox, Page, Spinner } from "@/components/ui";
import { useGet } from "@/hooks/api";
import { useT } from "@/lib/i18n";
import type { AdminStats } from "@/types";

export default function AdminDashboard() {
  const t = useT();
  const q = useGet<AdminStats>("/admin/stats");
  if (q.isLoading) return <Spinner />;
  if (!q.data) return <div className="p-6"><ErrorBox error={q.error} /></div>;
  const s = q.data.data;
  const items: [string, number][] = [["Người dùng", s.users], ["Mới (7 ngày)", s.new_users_7d], ["Hoạt động hôm nay", s.active_users_today],
    ["Từ vựng", s.words], ["Câu hỏi", s.questions], ["Lượt quiz", s.quiz_attempts], ["Lượt game", s.games_played], ["Bài speaking", s.speaking_sessions]];
  const max = Math.max(1, ...s.daily_active_users.map((d) => d.users));
  return (
    <Page title="Admin Dashboard">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {items.map(([l, v]) => <Card key={l}><p className="text-sm text-slate-500">{t(l)}</p><p className="text-2xl font-bold">{v}</p></Card>)}
      </div>
      <Card>
        <h2 className="mb-3 font-semibold">{t("Người dùng hoạt động theo ngày (14 ngày)")}</h2>
        {s.daily_active_users.length === 0 ? <p className="text-slate-500">{t("Chưa có dữ liệu.")}</p> : (
          <div className="flex h-40 items-end gap-2">
            {s.daily_active_users.map((d) => (
              <div key={d.date} className="flex flex-1 flex-col items-center justify-end gap-1" title={`${d.date}: ${d.users}`}>
                <span className="text-xs">{d.users}</span>
                <div className="w-full rounded-t bg-indigo-500" style={{ height: `${(d.users / max) * 100}%` }} />
                <span className="text-[10px] text-slate-500">{d.date.slice(5)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </Page>
  );
}
