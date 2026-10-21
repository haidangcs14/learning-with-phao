"use client";

import Link from "next/link";
import { useState } from "react";
import { Card, Empty, ErrorBox, Page, Pager, Spinner, Tabs, inputCls } from "@/components/ui";
import { useGet } from "@/hooks/api";
import { useT } from "@/lib/i18n";
import { qs } from "@/lib/utils";
import { useAuth } from "@/store/auth-store";

export type Kind = "reading" | "listening";
interface Item { id: string; slug: string; title: string; level: string; topic: string; word_count: number; question_count: number }
interface Progress { best: Record<string, { correct: number; total: number }>; completed: number; points: number }

export const LEVEL_COLOR: Record<string, string> = {
  A1: "bg-emerald-100 text-emerald-800", A2: "bg-green-100 text-green-800", B1: "bg-sky-100 text-sky-800",
  B2: "bg-blue-100 text-blue-800", C1: "bg-violet-100 text-violet-800", C2: "bg-fuchsia-100 text-fuchsia-800",
};
const LEVELS = ["", "A1", "A2", "B1", "B2", "C1", "C2"] as const;

export function PracticeList({ kind }: { kind: Kind }) {
  const t = useT();
  const user = useAuth((s) => s.user);
  const [level, setLevel] = useState<string>("");
  const [input, setInput] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const list = useGet<Item[]>(`/practice/${kind}?${qs({ level, q, page, limit: 12 })}`);
  const prog = useGet<Progress>(user ? `/practice/${kind}/progress` : null);
  const items = list.data?.data ?? [];
  const best = prog.data?.data.best ?? {};

  return (
    <Page title={kind === "reading" ? t("Đọc hiểu") : t("Luyện nghe")}>
      <p className="text-slate-500 dark:text-slate-400">
        {kind === "reading" ? t("Bài đọc theo từng cấp độ. Đọc xong, làm câu hỏi trắc nghiệm để xem kết quả ngay.")
          : t("Nghe hội thoại và bài nói (giọng đọc do trình duyệt tạo), rồi trả lời câu hỏi.")}
      </p>
      {prog.data && (
        <Card className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <span>✅ {t("Đã hoàn thành {n} bài", { n: prog.data.data.completed })}</span>
          <span>⭐ {t("{n} điểm", { n: prog.data.data.points })}</span>
        </Card>
      )}
      <Tabs value={level} onChange={(l) => { setLevel(l); setPage(1); }} options={LEVELS.map((l) => [l, l || t("Tất cả")] as const)} />
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setQ(input); setPage(1); }}>
        <input className={`${inputCls} sm:max-w-xs`} placeholder={t("Tìm theo tiêu đề...")} value={input} onChange={(e) => setInput(e.target.value)} />
        <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white">{t("Tìm")}</button>
      </form>
      {list.isLoading ? <Spinner /> : list.error ? <ErrorBox error={list.error} /> : items.length === 0 ? <Empty>{t("Chưa có bài nào. Hãy chạy seed.")}</Empty> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it) => {
            const b = best[it.slug];
            return (
              <Link key={it.id} href={`/${kind}/${it.slug}`} className="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-indigo-500 hover:shadow dark:border-slate-800 dark:bg-slate-900/60">
                <div className="flex items-center justify-between">
                  <span className={`rounded px-2 py-0.5 text-xs font-semibold ${LEVEL_COLOR[it.level] ?? ""}`}>{it.level}</span>
                  {b && <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${b.correct === b.total ? "bg-green-600 text-white" : "bg-amber-500 text-white"}`}>✓ {b.correct}/{b.total}</span>}
                </div>
                <h3 className="mt-2 font-semibold">{it.title}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">{it.topic} · {t("{w} từ", { w: it.word_count })} · {t("{q} câu hỏi", { q: it.question_count })}</p>
              </Link>
            );
          })}
        </div>
      )}
      <Pager meta={list.data?.meta} onPage={setPage} />
    </Page>
  );
}
