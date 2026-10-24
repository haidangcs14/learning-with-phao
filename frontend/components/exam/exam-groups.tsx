"use client";

import type { ReactNode } from "react";
import { RichText } from "@/components/exam/rich-text";
import type { Detail, ExamGroup, ExamQuestion } from "@/components/exam/types";
import { inputCls } from "@/components/ui";

interface Props {
  groups: ExamGroup[];
  answers: Record<string, string>;
  onChange?: (no: number, value: string) => void;
  review?: Record<number, Detail>; // present = read-only review with green/red marking
}

const GOOD = "border-green-600 bg-green-50 dark:bg-green-950/60";
const BAD = "border-[#b5412a] bg-[#b5412a]/10 dark:border-[#ef8a74]";

function tone(d: Detail | undefined): string {
  if (!d || !d.scored) return "border-slate-300 dark:border-slate-600";
  return d.is_correct ? GOOD : BAD;
}

function Expected({ d }: { d: Detail | undefined }) {
  if (!d || !d.scored || d.is_correct) return null;
  return <span className="ml-1 text-xs font-medium text-green-700 dark:text-green-400">→ {d.correct.join(" / ")}</span>;
}

function Blank({ q, value, onChange, review }: { q: ExamQuestion; value: string; onChange?: (v: string) => void; review?: Record<number, Detail> }) {
  const d = review?.[q.no];
  const cls = `inline-block rounded-md border-2 bg-white px-2 py-0.5 text-sm text-slate-900 dark:bg-slate-900 dark:text-slate-100 ${tone(d)}`;
  return (
    <span id={`q-${q.no}`} className="mx-1 inline-flex scroll-mt-24 items-center gap-1 align-baseline">
      <span className="rounded bg-slate-200 px-1 text-[10px] font-bold dark:bg-slate-700">{q.no}</span>
      {q.type === "mc" ? (
        <select className={cls} value={value} disabled={!!review} onChange={(e) => onChange?.(e.target.value)}>
          <option value="">—</option>
          {q.options.map((o) => <option key={o.key} value={o.key}>{o.key}. {o.text}</option>)}
        </select>
      ) : (
        <input className={`${cls} w-32`} value={value} disabled={!!review} maxLength={200} autoComplete="off" spellCheck={false} onChange={(e) => onChange?.(e.target.value)} />
      )}
      <Expected d={d} />
    </span>
  );
}

function QuestionCard({ q, value, onChange, review }: { q: ExamQuestion; value: string; onChange?: (v: string) => void; review?: Record<number, Detail> }) {
  const d = review?.[q.no];
  return (
    <div id={`q-${q.no}`} className={`scroll-mt-24 rounded-xl border-2 p-3 ${d?.scored ? (d.is_correct ? GOOD : BAD) : "border-slate-200 dark:border-slate-800"}`}>
      <p className="font-medium"><span className="mr-2 rounded bg-slate-200 px-1.5 py-0.5 text-xs font-bold dark:bg-slate-700">{q.no}</span><RichText text={q.prompt} /></p>
      {q.type === "mc" ? (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {q.options.map((o) => {
            const chosen = value === o.key;
            const right = d?.correct.includes(o.key);
            const cls = !review ? (chosen ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950" : "border-slate-300 hover:border-indigo-400 dark:border-slate-700")
              : right && d?.scored ? "border-green-600 bg-green-100 font-semibold text-green-900 dark:bg-green-900 dark:text-green-100"
              : chosen && d?.scored ? "border-[#b5412a] bg-[#b5412a]/10 font-semibold" : "border-slate-200 opacity-70 dark:border-slate-700";
            return (
              <button key={o.key} type="button" disabled={!!review} onClick={() => onChange?.(chosen ? "" : o.key)} className={`flex gap-2 rounded-lg border-2 px-3 py-2 text-left text-sm transition ${cls}`}>
                <b>{o.key}.</b><span><RichText text={o.text} /></span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="mt-2 flex items-center">
          <input className={`${inputCls} max-w-xs ${review ? tone(d) : ""}`} value={value} disabled={!!review} maxLength={200} autoComplete="off" spellCheck={false} onChange={(e) => onChange?.(e.target.value)} />
          <Expected d={d} />
        </div>
      )}
      {review && q.explanation && <p className="mt-2 rounded bg-slate-50 p-2 text-sm text-slate-700 dark:bg-slate-800/60 dark:text-slate-300">💡 <RichText text={q.explanation} /></p>}
    </div>
  );
}

export function ExamGroups({ groups, answers, onChange, review }: Props) {
  return (
    <div className="space-y-8">
      {groups.map((g) => {
        const byNo = new Map(g.questions.map((q) => [q.no, q]));
        const loose = g.questions.filter((q) => !q.inline);
        const passage = (par: string): ReactNode[] => par.split(/(\{\{\d+\}\})/g).map((tok, i) => {
          const m = tok.match(/^\{\{(\d+)\}\}$/);
          const q = m ? byNo.get(Number(m[1])) : undefined;
          return q ? <Blank key={i} q={q} value={answers[String(q.no)] ?? ""} onChange={(v) => onChange?.(q.no, v)} review={review} /> : <RichText key={i} text={tok} />;
        });
        return (
          <section key={g.id} className="space-y-3">
            <div>
              <span className={`rounded px-2 py-0.5 text-xs font-bold ${g.kind === "listening" ? "bg-cyan-100 text-cyan-900" : "bg-indigo-100 text-indigo-800"}`}>{g.kind === "listening" ? "🎧 " : ""}{g.section}</span>
              {g.instruction && <p className="mt-2 font-semibold"><RichText text={g.instruction} /></p>}
            </div>
            {g.passage.length > 0 && <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 leading-loose dark:border-slate-800 dark:bg-slate-900/60">{g.passage.map((p, i) => <p key={i}>{passage(p)}</p>)}</div>}
            {loose.length > 0 && <div className="space-y-3">{loose.map((q) => <QuestionCard key={q.no} q={q} value={answers[String(q.no)] ?? ""} onChange={(v) => onChange?.(q.no, v)} review={review} />)}</div>}
          </section>
        );
      })}
    </div>
  );
}
