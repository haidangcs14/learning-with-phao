"use client";

import Link from "next/link";
import { Protected } from "@/components/protected";
import type { ExamSummary } from "@/components/exam/types";
import { Card, Empty, ErrorBox, Page, Spinner } from "@/components/ui";
import { useGet } from "@/hooks/api";
import { useT } from "@/lib/i18n";

function Exams() {
  const t = useT();
  const q = useGet<ExamSummary[]>("/exams");
  const items = q.data?.data ?? [];
  if (q.isLoading) return <Spinner />;
  if (q.error) return <ErrorBox error={q.error} />;
  if (items.length === 0) return <Empty>{t("Chưa có bài kiểm tra nào. Giáo viên sẽ tải lên và công khai bài kiểm tra.")}</Empty>;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((e) => (
        <Card key={e.id} className="space-y-2">
          <h2 className="text-lg font-semibold">{e.title}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">⏱ {t("{n} phút", { n: e.duration_minutes })} · {t("{n} câu hỏi", { n: e.question_count })} · {t("{n} điểm", { n: e.total_score })}{e.has_audio ? " · 🎧" : ""}</p>
          {e.my ? <p className="text-sm"><span className="rounded-full bg-green-600 px-2 py-0.5 text-xs font-semibold text-white">{t("Điểm cao nhất")}: {e.my.best}/{e.my.max}</span> <span className="text-slate-500">· {t("{n} lần làm", { n: e.my.count })}</span></p> : null}
          <Link href={`/exams/${e.id}`} className="inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">{e.my ? t("Làm lại") : t("Vào làm bài")}</Link>
        </Card>
      ))}
    </div>
  );
}

export default function ExamsPage() {
  const t = useT();
  return <Protected><Page title={t("Bài kiểm tra")}><Exams /></Page></Protected>;
}
