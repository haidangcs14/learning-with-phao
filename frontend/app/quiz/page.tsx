"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BackButton } from "@/components/back-link";
import { Protected } from "@/components/protected";
import { Button, Card, ErrorBox, Page, Spinner, inputCls } from "@/components/ui";
import { useGet, useSend } from "@/hooks/api";
import { useT } from "@/lib/i18n";
import { topicInfo } from "@/lib/topics";
import { useLang } from "@/store/lang-store";
import type { Question, QuizResult } from "@/types";

type Kind = "bank" | "word_to_meaning" | "meaning_to_word" | "definition_to_word";
interface Setup { kind: Kind; level: string; topic: string; count: number; seconds: number }
interface TopicRow { topic: string; count: number }
const KINDS: { id: Kind; icon: string; name: string; desc: string }[] = [
  { id: "bank", icon: "📚", name: "Ngân hàng câu hỏi", desc: "Câu hỏi trắc nghiệm do giáo viên soạn (ngữ pháp, từ vựng, ...)." },
  { id: "word_to_meaning", icon: "🔤", name: "Nghĩa của từ", desc: "Cho từ tiếng Anh, chọn nghĩa tiếng Việt đúng." },
  { id: "meaning_to_word", icon: "💡", name: "Tìm từ theo nghĩa", desc: "Cho nghĩa tiếng Việt, chọn từ tiếng Anh đúng." },
  { id: "definition_to_word", icon: "📖", name: "Tìm từ theo định nghĩa", desc: "Cho định nghĩa tiếng Anh, chọn từ đúng." },
];
const DEFAULT: Setup = { kind: "bank", level: "", topic: "", count: 10, seconds: 0 };
const pill = (on: boolean) => `rounded-lg border-2 px-3 py-1.5 text-sm font-medium transition ${on ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300 hover:border-indigo-400 dark:border-slate-700"}`;

function Quiz() {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const [setup, setSetup] = useState<Setup>(DEFAULT);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [sid, setSid] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);
  const [, setAnswers] = useState<Record<string, string>>({});
  const answersRef = useRef<Record<string, string>>({});
  const [left, setLeft] = useState(0);
  const topics = useGet<TopicRow[]>(setup.kind === "bank" ? "/quiz/topics" : "/words/topics");
  const bank = useSend<Question[], string>("GET", (q) => `/quiz/questions?${q}`);
  const generate = useSend<{ session_id: string; questions: Question[] }, { kind: string; topic?: string; level?: string; count: number }>("POST", "/quiz/generate");
  const submit = useSend<QuizResult, { sid: string | null; answers: { question_id: string; answer: string }[] }>(
    "POST", (v) => (v.sid ? `/quiz/sessions/${v.sid}/submit` : "/quiz/submit"), ["/leaderboard", "/activity"], (v) => ({ answers: v.answers }));
  const set = <K extends keyof Setup>(k: K, v: Setup[K]) => setSetup((s) => ({ ...s, [k]: v, ...(k === "kind" ? { topic: "" } : {}) }));

  function begin() {
    const ready = (qs: Question[], session: string | null) => { setQuestions(qs); setSid(session); setIdx(0); answersRef.current = {}; setAnswers({}); submit.reset(); };
    if (setup.kind === "bank") {
      const q = new URLSearchParams({ limit: String(setup.count), ...(setup.level ? { level: setup.level } : {}), ...(setup.topic ? { topic: setup.topic } : {}) });
      bank.mutate(q.toString(), { onSuccess: (r) => ready(r.data, null) });
    } else {
      generate.mutate({ kind: setup.kind, count: setup.count, ...(setup.level ? { level: setup.level } : {}), ...(setup.topic ? { topic: setup.topic } : {}) },
        { onSuccess: (r) => ready(r.data.questions, r.data.session_id) });
    }
  }
  const answer = useCallback((q: Question, option: string) => {
    const next = { ...answersRef.current, [q.id]: option }; // never submit from inside a state updater (strict mode runs those twice)
    answersRef.current = next;
    setAnswers(next);
    if (idx + 1 < questions.length) setIdx(idx + 1);
    else submit.mutate({ sid, answers: questions.map((x) => ({ question_id: x.id, answer: next[x.id] ?? "" })) });
  }, [idx, questions, sid, submit]);

  const q = questions[idx];
  // per-question timer (optional): when time runs out the question counts as unanswered
  useEffect(() => { if (q && !submit.data) setLeft(setup.seconds); }, [q, setup.seconds, submit.data]);
  useEffect(() => {
    if (!q || !setup.seconds || submit.isPending || submit.data) return;
    if (left <= 0) { answer(q, ""); return; }
    const id = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [left, q, setup.seconds, submit.isPending, submit.data, answer]);
  useEffect(() => { // keys 1-4 pick an option
    if (!q) return;
    const onKey = (e: KeyboardEvent) => { const o = q.options[Number(e.key) - 1]; if (o) answer(q, o); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [q, answer]);

  const result = submit.data?.data;
  const reset = () => { setQuestions([]); setSid(null); setIdx(0); answersRef.current = {}; setAnswers({}); submit.reset(); };

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
            <div key={r.question_id} className={`rounded-xl border-2 p-4 ${r.correct ? "border-green-500 bg-green-50 dark:bg-green-950/60" : "border-red-500 bg-red-50 dark:bg-red-950/60"}`}>
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium">{item?.question}</p>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold text-white ${r.correct ? "bg-green-600" : "bg-red-600"}`}>{r.correct ? t("Đúng") : r.your_answer ? t("Sai") : t("Hết giờ")}</span>
              </div>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {(item?.options ?? [r.correct_answer]).map((o) => {
                  const isAnswer = o === r.correct_answer;
                  const isWrongPick = o === r.your_answer && !r.correct;
                  const cls = isAnswer ? "border-green-600 bg-green-100 font-semibold text-green-900 dark:bg-green-900 dark:text-green-100"
                    : isWrongPick ? "border-red-600 bg-red-100 font-semibold text-red-900 dark:bg-red-900 dark:text-red-100" : "border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300";
                  return <li key={o} className={`flex justify-between rounded-lg border px-3 py-2 text-sm ${cls}`}><span>{o}</span><span>{isAnswer ? "✓" : isWrongPick ? "✗" : ""}</span></li>;
                })}
              </ul>
              {r.explanation && <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{r.explanation}</p>}
            </div>
          );
        })}
        <div className="flex gap-2"><Button onClick={begin}>{t("Làm bộ mới")}</Button><Button variant="ghost" onClick={reset}>{t("Đổi thiết lập")}</Button></div>
      </div>
    );
  }

  if (q) {
    return (
      <Card className="space-y-4">
        <div className="flex items-center justify-between gap-3 text-sm text-slate-500">
          <span>{t("Câu {i} / {n}", { i: idx + 1, n: questions.length })}</span>
          {setup.seconds > 0 && <b className={`rounded-full px-3 py-1 font-mono ${left <= 5 ? "animate-pulse bg-red-600 text-white" : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100"}`}>⏱ {left}s</b>}
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800" role="progressbar" aria-valuenow={idx} aria-valuemax={questions.length}><div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${(idx / questions.length) * 100}%` }} /></div>
        {setup.seconds > 0 && <div className="h-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"><div className="h-full rounded-full bg-amber-500 transition-all duration-1000 ease-linear" style={{ width: `${(left / setup.seconds) * 100}%` }} /></div>}
        <p className="text-lg font-semibold">{q.question}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {q.options.map((o, i) => (
            <button key={o} disabled={submit.isPending} onClick={() => answer(q, o)}
              className="flex items-center gap-3 rounded-xl border-2 border-slate-300 bg-white px-4 py-3 text-left font-medium transition hover:border-indigo-500 hover:bg-indigo-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-indigo-950">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-sm font-bold dark:bg-slate-800">{i + 1}</span>{o}
            </button>
          ))}
        </div>
        {submit.error && <ErrorBox error={submit.error} />}
        <BackButton onClick={reset}>{t("← Thoát bài")}</BackButton>
      </Card>
    );
  }

  const info = (topic: string) => topicInfo(topic, lang);
  const list = topics.data?.data ?? [];
  const loading = bank.isPending || generate.isPending;
  return (
    <div className="space-y-5">
      <section><h2 className="mb-2 font-semibold">{t("Kiểu bài")}</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {KINDS.map((k) => (
            <button key={k.id} role="radio" aria-checked={setup.kind === k.id} onClick={() => set("kind", k.id)}
              className={`flex items-start gap-3 rounded-xl border-2 p-3 text-left transition ${setup.kind === k.id ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950" : "border-slate-200 hover:border-indigo-400 dark:border-slate-800"}`}>
              <span className="text-2xl">{k.icon}</span><span><b className="block">{t(k.name)}</b><span className="text-sm text-slate-500 dark:text-slate-400">{t(k.desc)}</span></span>
            </button>
          ))}
        </div>
      </section>
      <section className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium">{t("Cấp độ")}
          <select className={`${inputCls} mt-1`} value={setup.level} onChange={(e) => set("level", e.target.value)}>
            {["", "A1", "A2", "B1", "B2", "C1", "C2"].map((l) => <option key={l} value={l}>{l || t("Mọi cấp độ")}</option>)}
          </select></label>
        <label className="text-sm font-medium">{t("Chủ đề")}
          <select className={`${inputCls} mt-1`} value={setup.topic} onChange={(e) => set("topic", e.target.value)}>
            <option value="">{t("Tất cả chủ đề")}</option>
            {list.map((x) => <option key={x.topic} value={x.topic}>{setup.kind === "bank" ? x.topic : `${info(x.topic).icon} ${info(x.topic).label}`} ({x.count})</option>)}
          </select></label>
        <div><p className="mb-1 text-sm font-medium">{t("Số câu hỏi")}</p><div className="flex flex-wrap gap-2">{[5, 10, 15, 20].map((n) => <button key={n} className={pill(setup.count === n)} onClick={() => set("count", n)}>{n}</button>)}</div></div>
        <div><p className="mb-1 text-sm font-medium">{t("Thời gian mỗi câu")}</p><div className="flex flex-wrap gap-2">{[0, 15, 30].map((s) => <button key={s} className={pill(setup.seconds === s)} onClick={() => set("seconds", s)}>{s === 0 ? t("Không giới hạn") : `${s}s`}</button>)}</div></div>
      </section>
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={begin} disabled={loading}>{loading ? <Spinner /> : t("Bắt đầu ({n} câu)", { n: setup.count })}</Button>
        <span className="text-sm text-slate-500">{t("Mẹo: nhấn phím 1-4 để chọn đáp án nhanh.")}</span>
      </div>
      {bank.isSuccess && questions.length === 0 && <p className="text-slate-500">{t("Chưa có câu hỏi phù hợp.")}</p>}
      {(bank.error || generate.error) && <ErrorBox error={bank.error ?? generate.error} />}
    </div>
  );
}

export default function QuizPage() {
  return <Protected><Page title="Quiz"><Quiz /></Page></Protected>;
}
