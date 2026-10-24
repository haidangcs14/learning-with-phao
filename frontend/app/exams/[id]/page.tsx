"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useConfirm } from "@/components/confirm";
import { ExamAudio } from "@/components/exam/exam-audio";
import { ExamGroups } from "@/components/exam/exam-groups";
import type { Attempt, PublicExam } from "@/components/exam/types";
import { useCountdown } from "@/components/exam/use-countdown";
import { Protected } from "@/components/protected";
import { Button, Card, ErrorBox, Page, Spinner } from "@/components/ui";
import { useGet, useSend } from "@/hooks/api";
import { useT } from "@/lib/i18n";

const pad = (n: number) => String(n).padStart(2, "0");

function Runner({ attempt }: { attempt: Attempt }) {
  const t = useT();
  const ask = useConfirm();
  const router = useRouter();
  const exam = attempt.exam;
  const [answers, setAnswers] = useState<Record<string, string>>(attempt.answers);
  const latest = useRef(answers);
  latest.current = answers;
  const dirty = useRef(false);
  const finished = useRef(false);
  const save = useSend<{ status: string }, { answers: Record<string, string> }>("PUT", `/exams/attempts/${attempt.id}/answers`);
  const submit = useSend<unknown, { answers: Record<string, string> }>("POST", `/exams/attempts/${attempt.id}/submit`, ["/exams"]);

  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    submit.mutate({ answers: latest.current }, { onSuccess: () => router.replace(`/exams/result/${attempt.id}`), onError: () => { finished.current = false; } });
  }, [attempt.id, router, submit]);
  const left = useCountdown(attempt.deadline, attempt.server_now, finish);

  useEffect(() => { // autosave 1.5 s after the last change
    if (!dirty.current) return;
    const id = setTimeout(() => {
      dirty.current = false;
      save.mutate({ answers: latest.current }, { onSuccess: (r) => { if (r.data.status === "submitted") router.replace(`/exams/result/${attempt.id}`); } });
    }, 1500);
    return () => clearTimeout(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers]);
  useEffect(() => { // protect against closing the tab by accident
    const warn = (e: BeforeUnloadEvent) => { if (!finished.current) e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  const numbers = exam.groups.flatMap((g) => g.questions.map((q) => q.no)).sort((a, b) => a - b);
  const answered = numbers.filter((n) => (answers[String(n)] ?? "").trim()).length;
  const onChange = (no: number, v: string) => { dirty.current = true; setAnswers((a) => ({ ...a, [String(no)]: v })); };

  async function confirmSubmit() {
    const missing = numbers.length - answered;
    const ok = await ask({ title: t("Nộp bài?"), message: missing > 0 ? t("Bạn còn {n} câu chưa trả lời. Sau khi nộp sẽ không sửa được.", { n: missing }) : t("Sau khi nộp sẽ không sửa được bài."), confirmLabel: t("Nộp bài") });
    if (ok) finish();
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-4">
      <div className="sticky top-14 z-20 -mx-4 mb-4 border-b border-slate-200 bg-white/95 px-4 py-2 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="truncate font-semibold">{exam.title}</p>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500">{answered}/{numbers.length}</span>
            <span className={`rounded-lg px-3 py-1 font-mono text-lg font-bold ${left <= 300 ? "animate-pulse bg-red-600 text-white" : "bg-slate-100 dark:bg-slate-800"}`} aria-label={t("Thời gian còn lại")}>⏱ {pad(Math.floor(left / 60))}:{pad(left % 60)}</span>
            <Button disabled={submit.isPending} onClick={confirmSubmit}>{t("Nộp bài")}</Button>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-1" aria-label={t("Danh sách câu hỏi")}>
          {numbers.map((n) => (
            <a key={n} href={`#q-${n}`} className={`flex h-7 w-7 items-center justify-center rounded text-xs font-semibold ${(answers[String(n)] ?? "").trim() ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200"}`}>{n}</a>
          ))}
        </div>
      </div>
      {exam.has_audio && <div className="mb-4"><ExamAudio examId={exam.id} /></div>}
      <ExamGroups groups={exam.groups} answers={answers} onChange={onChange} />
      {(submit.error || save.error) && <div className="mt-4"><ErrorBox error={submit.error ?? save.error} /></div>}
      <div className="mt-8 flex justify-end"><Button disabled={submit.isPending} onClick={confirmSubmit}>{t("Nộp bài")}</Button></div>
    </div>
  );
}

function Intro() {
  const t = useT();
  const { id } = useParams<{ id: string }>();
  const q = useGet<PublicExam>(`/exams/${id}`);
  const start = useSend<Attempt>("POST", `/exams/${id}/start`);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  if (attempt) return <Runner attempt={attempt} />;
  if (q.isLoading) return <Spinner />;
  if (!q.data) return <div className="p-6"><ErrorBox error={q.error} /></div>;
  const e = q.data.data;
  return (
    <Page title={e.title}>
      <Link href="/exams" className="text-sm text-indigo-600">{t("← Tất cả bài kiểm tra")}</Link>
      <Card className="space-y-3">
        <ul className="space-y-1 text-sm">
          <li>⏱ {t("Thời gian làm bài: {n} phút", { n: e.duration_minutes })}</li>
          <li>📝 {t("{n} câu hỏi", { n: e.question_count })} · {t("{n} điểm", { n: e.total_score })}</li>
          {e.has_audio && <li>🎧 {t("Có phần nghe: hãy chuẩn bị tai nghe.")}</li>}
        </ul>
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">{t("Đồng hồ chạy ngay khi bạn bấm bắt đầu và hết giờ bài sẽ tự động nộp. Câu trả lời được lưu tự động; nếu lỡ thoát ra, bạn có thể vào lại để làm tiếp.")}</p>
        {start.error && <ErrorBox error={start.error} />}
        <Button disabled={start.isPending} onClick={() => start.mutate(undefined, { onSuccess: (r) => setAttempt(r.data) })}>{t("Bắt đầu / Tiếp tục làm bài")}</Button>
      </Card>
    </Page>
  );
}

export default function ExamPage() {
  return <Protected><Intro /></Protected>;
}
