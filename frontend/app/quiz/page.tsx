"use client";

import { useState } from "react";
import { Protected } from "@/components/protected";
import { Button, Card, ErrorBox, Page, inputCls } from "@/components/ui";
import { useSend } from "@/hooks/api";
import { useT } from "@/lib/i18n";
import type { Question, QuizResult } from "@/types";

function Quiz() {
  const t = useT();
  const [level, setLevel] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const start = useSend<Question[], string>("GET", (q) => `/quiz/questions?${q}`);
  const submit = useSend<QuizResult, { answers: { question_id: string; answer: string }[] }>("POST", "/quiz/submit", ["/leaderboard", "/activity"]);

  function begin() {
    start.mutate(`limit=10${level ? `&level=${level}` : ""}`, {
      onSuccess: (r) => { setQuestions(r.data); setIdx(0); setAnswers({}); submit.reset(); },
    });
  }
  function pick(q: Question, option: string) {
    const next = { ...answers, [q.id]: option };
    setAnswers(next);
    if (idx + 1 < questions.length) setIdx(idx + 1);
    else submit.mutate({ answers: Object.entries(next).map(([question_id, answer]) => ({ question_id, answer })) });
  }

  const result = submit.data?.data;
  const q = questions[idx];
  if (result) {
    const wrongCount = result.total - result.correct;
    return (
      <div className="space-y-3">
        <Card>
          <p className="text-2xl font-bold">{t("{c}/{n} đúng ({p}%)", { c: result.correct, n: result.total, p: result.accuracy })}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-full bg-green-600 px-3 py-1 font-semibold text-white">✓ {result.correct}</span>
            <span className="rounded-full bg-red-600 px-3 py-1 font-semibold text-white">✗ {wrongCount}</span>
            <span>+{result.xp_awarded} XP</span>
          </div>
        </Card>
        {result.results.map((r) => {
          const item = questions.find((x) => x.id === r.question_id);
          return (
            <div key={r.question_id}
              className={`rounded-xl border-2 p-4 ${r.correct ? "border-green-500 bg-green-50 dark:bg-green-950/60" : "border-red-500 bg-red-50 dark:bg-red-950/60"}`}>
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium">{item?.question}</p>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold text-white ${r.correct ? "bg-green-600" : "bg-red-600"}`}>{r.correct ? t("Đúng") : t("Sai")}</span>
              </div>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {(item?.options ?? [r.correct_answer]).map((o) => {
                  const isAnswer = o === r.correct_answer;
                  const isWrongPick = o === r.your_answer && !r.correct;
                  const cls = isAnswer ? "border-green-600 bg-green-100 font-semibold text-green-900 dark:bg-green-900 dark:text-green-100"
                    : isWrongPick ? "border-red-600 bg-red-100 font-semibold text-red-900 dark:bg-red-900 dark:text-red-100"
                    : "border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300";
                  return <li key={o} className={`flex justify-between rounded-lg border px-3 py-2 text-sm ${cls}`}><span>{o}</span><span>{isAnswer ? "✓" : isWrongPick ? "✗" : ""}</span></li>;
                })}
              </ul>
              {r.explanation && <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{r.explanation}</p>}
            </div>
          );
        })}
        <Button onClick={begin}>{t("Làm bộ mới")}</Button>
      </div>
    );
  }
  if (!q) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <select className={`${inputCls} w-auto`} value={level} onChange={(e) => setLevel(e.target.value)}>
          {["", "A1", "A2", "B1", "B2", "C1", "C2"].map((l) => <option key={l} value={l}>{l || t("Mọi cấp độ")}</option>)}
        </select>
        <Button onClick={begin} disabled={start.isPending}>{t("Bắt đầu (10 câu)")}</Button>
        {start.isSuccess && questions.length === 0 && <p className="text-slate-500">{t("Chưa có câu hỏi phù hợp.")}</p>}
        {start.error && <ErrorBox error={start.error} />}
      </div>
    );
  }
  return (
    <Card className="space-y-3">
      <p className="text-sm text-slate-500">{t("Câu {i} / {n}", { i: idx + 1, n: questions.length })}</p>
      <p className="text-lg font-semibold">{q.question}</p>
      <div className="grid gap-2">
        {q.options.map((o) => <Button key={o} variant="ghost" disabled={submit.isPending} className="text-left" onClick={() => pick(q, o)}>{o}</Button>)}
      </div>
      {submit.error && <ErrorBox error={submit.error} />}
    </Card>
  );
}

export default function QuizPage() {
  const t = useT();
  return <Protected><Page title="Quiz"><Quiz /></Page></Protected>;
}
