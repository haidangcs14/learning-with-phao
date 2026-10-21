"use client";

import Link from "next/link";
import { useState } from "react";
import { LEVEL_COLOR, type Kind } from "@/components/practice/practice-list";
import { TtsPlayer } from "@/components/tts-player";
import { Button, Card, ErrorBox, Spinner } from "@/components/ui";
import { useGet, useSend } from "@/hooks/api";
import { useT } from "@/lib/i18n";
import { useLang } from "@/store/lang-store";
import { speak } from "@/lib/utils";
import { useAuth } from "@/store/auth-store";

interface Detail {
  id: string; slug: string; title: string; level: string; topic: string; word_count: number;
  text?: string[]; script?: { speaker?: string | null; text: string }[];
  vocabulary: { word: string; vi: string }[]; questions: { q: string; options: string[] }[];
}
interface Result { total: number; correct: number; xp_awarded: number; results: { correct: boolean; your_answer: number; answer: number }[] }

export function PracticeDetail({ kind, slug }: { kind: Kind; slug: string }) {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const user = useAuth((s) => s.user);
  const q = useGet<Detail>(`/practice/${kind}/${slug}`);
  const [picked, setPicked] = useState<Record<number, number>>({});
  const [showScript, setShowScript] = useState(false);
  const submit = useSend<Result, { answers: number[] }>("POST", `/practice/${kind}/${slug}/submit`, ["/practice"]);

  if (q.isLoading) return <Spinner />;
  if (!q.data) return <div className="p-6"><ErrorBox error={q.error} /></div>;
  const d = q.data.data;
  const result = submit.data?.data;
  const allAnswered = Object.keys(picked).length === d.questions.length;

  function send() { submit.mutate({ answers: d.questions.map((_, i) => picked[i] ?? -1) }); }
  function retry() { setPicked({}); submit.reset(); }

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <Link href={`/${kind}`} className="text-sm text-indigo-600">{kind === "reading" ? t("← Tất cả bài đọc") : t("← Tất cả bài nghe")}</Link>
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">{d.title}</h1>
        <p className="mt-1 flex items-center gap-2 text-sm text-slate-500">
          <span className={`rounded px-2 py-0.5 text-xs font-semibold ${LEVEL_COLOR[d.level] ?? ""}`}>{d.level}</span>{d.topic} · {t("{w} từ", { w: d.word_count })}
        </p>
      </div>

      {kind === "listening" && d.script && (
        <section className="space-y-2">
          <TtsPlayer lines={d.script} showText={showScript || !!result} />
          {!result && <button className="text-sm text-indigo-600 underline" onClick={() => setShowScript(!showScript)}>{showScript ? t("Ẩn bản ghi") : t("Hiện bản ghi (transcript)")}</button>}
        </section>
      )}

      {kind === "reading" && (
        <>
          <article className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 text-lg leading-relaxed dark:border-slate-800 dark:bg-slate-900/60">
            {d.text?.map((p, i) => <p key={i}>{p}</p>)}
          </article>
          {d.vocabulary.length > 0 && (
            <section>
              <h2 className="mb-2 font-semibold">{t("Từ vựng trong bài")}</h2>
              <div className="flex flex-wrap gap-2">
                {d.vocabulary.map((v) => (
                  <button key={v.word} onClick={() => speak(v.word)} title={t("Nghe")}
                    className="rounded-full bg-indigo-50 px-3 py-1 text-sm text-indigo-900 hover:bg-indigo-100 dark:bg-indigo-950 dark:text-indigo-200">
                    🔊 <b>{v.word}</b>{lang === "vi" && <> — {v.vi}</>}
                  </button>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">{t("Câu hỏi")}</h2>
        {result && (
          <Card className="flex flex-wrap items-center gap-3">
            <span className="text-2xl font-bold">{t("{c}/{n} đúng ({p}%)", { c: result.correct, n: result.total, p: Math.round((result.correct / result.total) * 100) })}</span>
            <span className="rounded-full bg-green-600 px-3 py-1 text-sm font-semibold text-white">✓ {result.correct}</span>
            <span className="rounded-full bg-red-600 px-3 py-1 text-sm font-semibold text-white">✗ {result.total - result.correct}</span>
            {result.xp_awarded > 0 && <span className="text-sm">+{result.xp_awarded} XP</span>}
          </Card>
        )}
        {d.questions.map((qn, i) => {
          const r = result?.results[i];
          return (
            <div key={i} className={`rounded-xl border-2 p-4 ${!r ? "border-slate-200 dark:border-slate-800" : r.correct ? "border-green-500 bg-green-50 dark:bg-green-950/60" : "border-red-500 bg-red-50 dark:bg-red-950/60"}`}>
              <p className="font-medium">{i + 1}. {qn.q}</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {qn.options.map((o, oi) => {
                  const chosen = picked[i] === oi;
                  const isAnswer = r && oi === r.answer;
                  const isWrongPick = r && chosen && !r.correct;
                  const cls = !r ? (chosen ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950" : "border-slate-300 hover:border-indigo-400 dark:border-slate-700")
                    : isAnswer ? "border-green-600 bg-green-100 font-semibold text-green-900 dark:bg-green-900 dark:text-green-100"
                    : isWrongPick ? "animate-shake border-red-600 bg-red-100 font-semibold text-red-900 dark:bg-red-900 dark:text-red-100"
                    : "border-slate-200 opacity-60 dark:border-slate-700";
                  return (
                    <button key={oi} disabled={!!result} onClick={() => setPicked({ ...picked, [i]: oi })} className={`flex justify-between rounded-lg border-2 px-3 py-2 text-left text-sm transition ${cls}`}>
                      <span>{o}</span><span>{isAnswer ? "✓" : isWrongPick ? "✗" : ""}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
        {submit.error && <ErrorBox error={submit.error} />}
        {result ? <Button onClick={retry}>{t("Làm lại")}</Button>
          : user ? <Button disabled={!allAnswered || submit.isPending} onClick={send}>{t("Nộp bài")}</Button>
          : <p className="text-sm text-slate-500">{t("Vui lòng")} <Link href="/login" className="text-indigo-600 underline">{t("đăng nhập")}</Link> {t("để nộp bài và lưu điểm.")}</p>}
      </section>
    </main>
  );
}
