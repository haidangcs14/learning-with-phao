"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ErrorBox, Spinner } from "@/components/ui";
import { VideoEmbed } from "@/components/video-embed";
import { useGet } from "@/hooks/api";
import { useT } from "@/lib/i18n";
import { BackLink } from "@/components/back-link";
import { useLang } from "@/store/lang-store";

interface Exercise { question: string; options: string[]; answer: string; explanation: string }
interface Mistake { wrong: string; right: string }
interface English {
  description?: string; usage?: string[]; notes?: string[]; compare?: string[]; signals?: string[];
  explanations?: string[]; formula?: Record<string, string>; common_mistakes?: Mistake[];
}
interface Lesson {
  title: string; level: string; description: string; formula: Record<string, string>; usage: string[]; signals: string[];
  examples: { en: string; vi: string }[]; common_mistakes: Mistake[];
  notes?: string[]; compare?: string[]; exercises?: Exercise[]; video?: string; source?: string; en?: English;
}

function Exercises({ items }: { items: Exercise[] }) {
  const t = useT();
  const [picked, setPicked] = useState<Record<number, string>>({});
  return (
    <div className="space-y-4">
      {items.map((e, i) => {
        const p = picked[i];
        const done = p !== undefined;
        return (
          <div key={i} className="rounded-btn border border-border p-3">
            <p className="font-medium">{i + 1}. {e.question}</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {e.options.map((o) => {
                const isAnswer = o === e.answer;
                const isWrong = p === o && !isAnswer;
                const cls = !done ? "border-border hover:border-primary"
                  : isAnswer ? "border-success bg-success-soft text-success-text"
                  : isWrong ? "animate-shake border-error bg-error-soft text-error-text"
                  : "border-border opacity-50";
                return (
                  <button key={o} disabled={done} onClick={() => setPicked({ ...picked, [i]: o })} className={`rounded-btn border-2 px-3 py-2 text-left text-sm transition ${cls}`}>
                    {o} {done && isAnswer && "✓"} {isWrong && "✗"}
                  </button>
                );
              })}
            </div>
            {done && <p className={`mt-2 text-sm ${p === e.answer ? "text-success-text" : "text-error-text"}`}>
              {p === e.answer ? t("Chính xác!") : t("Đáp án đúng: {a}", { a: e.answer })} — {e.explanation}</p>}
          </div>
        );
      })}
      {Object.keys(picked).length > 0 && <button className="text-sm text-primary-text underline" onClick={() => setPicked({})}>{t("Làm lại")}</button>}
    </div>
  );
}

export default function GrammarDetailPage() {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const { slug } = useParams<{ slug: string }>();
  const q = useGet<Lesson>(`/grammar/${slug}`);
  if (q.isLoading) return <Spinner />;
  if (!q.data) return <div className="p-6"><ErrorBox error={q.error} /></div>;
  const raw = q.data.data;
  const en = lang === "en" ? raw.en : undefined; // English version of the explanations (falls back to Vietnamese if missing)
  const l: Lesson = en ? {
    ...raw, description: en.description ?? raw.description, usage: en.usage ?? raw.usage, notes: en.notes ?? raw.notes,
    compare: en.compare ?? raw.compare, signals: en.signals ?? raw.signals, formula: en.formula ?? raw.formula,
    common_mistakes: en.common_mistakes ?? raw.common_mistakes,
    exercises: raw.exercises?.map((e, i) => ({ ...e, explanation: en.explanations?.[i] ?? e.explanation })),
  } : raw;
  const h2 = "mb-2 text-xl font-semibold";
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <BackLink href="/grammar">{t("← Tất cả bài học")}</BackLink>
      <h1 className="text-3xl font-bold">{l.title} <span className="text-base text-muted-foreground">({l.level})</span></h1>
      <p className="text-muted-foreground">{l.description}</p>

      {Object.keys(l.formula).length > 0 && (
        <section>
          <h2 className={h2}>{t("Công thức")}</h2>
          <dl className="space-y-1 rounded-xl bg-surface-secondary p-4 font-mono text-sm">
            {Object.entries(l.formula).map(([k, v]) => <div key={k}><dt className="inline font-semibold">{t(k)}: </dt><dd className="inline">{v}</dd></div>)}
          </dl>
        </section>
      )}
      <section><h2 className={h2}>{t("Cách dùng")}</h2><ul className="list-disc space-y-1 pl-5">{l.usage.map((u) => <li key={u}>{u}</li>)}</ul></section>
      {l.signals.length > 0 && (
        <section><h2 className={h2}>{t("Dấu hiệu nhận biết")}</h2>
          <div className="flex flex-wrap gap-2">{l.signals.map((s) => <span key={s} className="rounded-full bg-primary-soft px-3 py-1 text-sm text-primary-text">{s}</span>)}</div></section>
      )}
      <section><h2 className={h2}>{t("Ví dụ")}</h2>
        <ul className="space-y-2">{l.examples.map((e) => <li key={e.en}><p className="font-medium">{e.en}</p>{lang === "vi" && <p className="text-sm text-muted-foreground">{e.vi}</p>}</li>)}</ul></section>
      {l.notes && l.notes.length > 0 && (
        <section><h2 className={h2}>{t("Lưu ý & quy tắc")}</h2><ul className="list-disc space-y-1 pl-5">{l.notes.map((n) => <li key={n}>{n}</li>)}</ul></section>
      )}
      {l.compare && l.compare.length > 0 && (
        <section><h2 className={h2}>{t("So sánh với thì khác")}</h2>
          <ul className="space-y-2">{l.compare.map((c) => <li key={c} className="rounded-btn bg-accent-soft p-3 text-sm text-accent-text">{c}</li>)}</ul></section>
      )}
      <section><h2 className={h2}>{t("Lỗi thường gặp")}</h2>
        <ul className="space-y-2">{l.common_mistakes.map((m) => (
          <li key={m.wrong} className="rounded-btn border border-border p-3 text-sm">
            <p className="text-error-text line-through">{m.wrong}</p><p className="text-success-text">{m.right}</p></li>))}</ul></section>
      {l.exercises && l.exercises.length > 0 && <section><h2 className={h2}>{t("Luyện tập")}</h2><Exercises items={l.exercises} /></section>}
      {l.video && <section><h2 className={h2}>{t("Video hướng dẫn")}</h2><VideoEmbed id={l.video} title={l.title} /></section>}
      {l.source && <p className="text-xs text-muted-foreground"><a className="text-primary-text underline" target="_blank" rel="noreferrer" href={l.source}>{t("Tham khảo thêm: ZIM Academy")}</a></p>}
    </main>
  );
}
