"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ExamAudio } from "@/components/exam/exam-audio";
import { ExamGroups } from "@/components/exam/exam-groups";
import type { ResultView } from "@/components/exam/types";
import { Protected } from "@/components/protected";
import { Card, ErrorBox, Page, Spinner } from "@/components/ui";
import { useGet } from "@/hooks/api";
import { useT } from "@/lib/i18n";

function Result() {
  const t = useT();
  const { attemptId } = useParams<{ attemptId: string }>();
  const q = useGet<ResultView>(`/exams/attempts/${attemptId}/result`);
  const [showTranscript, setShowTranscript] = useState(false);
  if (q.isLoading) return <Spinner />;
  if (!q.data) return <div className="p-6"><ErrorBox error={q.error} /></div>;
  const { result: r, exam, answers } = q.data.data;
  const review = Object.fromEntries(r.details.map((d) => [d.no, d]));
  const wrong = r.scored_count - r.correct_count;
  const pct = r.max_score ? Math.round((r.score / r.max_score) * 100) : 0;
  return (
    <Page title={exam.title}>
      <Link href="/exams" className="text-sm text-indigo-600">{t("← Tất cả bài kiểm tra")}</Link>
      <Card className="flex flex-wrap items-center gap-4">
        <div className="flex h-24 w-24 shrink-0 flex-col items-center justify-center rounded-full bg-indigo-600 text-white"><span className="text-2xl font-bold">{r.score}</span><span className="text-xs">/ {r.max_score}</span></div>
        <div className="space-y-1">
          <p className="text-lg font-semibold">{pct}%</p>
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="rounded-full bg-green-600 px-3 py-1 font-semibold text-white">✓ {t("{n} đúng", { n: r.correct_count })}</span>
            <span className="rounded-full bg-[#b5412a] px-3 py-1 font-semibold text-white">✗ {t("{n} sai", { n: wrong })}</span>
            <span className="rounded-full bg-slate-200 px-3 py-1 dark:bg-slate-700">{t("Đã trả lời {a}/{n}", { a: r.answered_count, n: r.total_questions })}</span>
          </div>
        </div>
      </Card>
      {exam.has_audio && <ExamAudio examId={exam.id} />}
      {exam.transcript && (
        <div><button className="text-sm text-indigo-600 underline" onClick={() => setShowTranscript(!showTranscript)}>{showTranscript ? t("Ẩn bản ghi") : t("Hiện bản ghi (transcript)")}</button>
          {showTranscript && <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800/60">{exam.transcript}</pre>}</div>
      )}
      <ExamGroups groups={exam.groups} answers={answers} review={review} />
      <Link href={`/exams/${exam.id}`} className="inline-block rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">{t("Làm lại bài này")}</Link>
    </Page>
  );
}

export default function ExamResultPage() {
  return <Protected><Result /></Protected>;
}
