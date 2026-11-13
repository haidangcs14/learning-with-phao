"use client";

import { useEffect, useRef, useState } from "react";
import { POS, norm, splitByWord, type StudySettings } from "@/components/study/utils";
import { WordPicture } from "@/components/study/word-picture";
import { VirtualKeyboard } from "@/components/virtual-keyboard";
import { useT } from "@/lib/i18n";
import { speak } from "@/lib/speech";
import { useLang } from "@/store/lang-store";
import type { Word } from "@/types";

interface Props {
  word: Word; settings: StudySettings; keyboard: boolean;
  onAnswer: (correct: boolean) => Promise<number>; // returns the XP that was awarded
  onNext: () => void; onReport: () => void;
}

/** The "guess the word" card: meaning + definitions + a gapped example, then type the English word. */
export function StudyCard({ word, settings, keyboard, onAnswer, onNext, onReport }: Props) {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const [typed, setTyped] = useState("");
  const [phase, setPhase] = useState<"ask" | "correct" | "revealed">("ask");
  const [hint, setHint] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [shake, setShake] = useState(false);
  const [xp, setXp] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const m = word.meanings[0];
  const target = word.word;
  const done = phase !== "ask";
  useEffect(() => { if (!keyboard) input.current?.focus(); }, [keyboard]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  if (!m) return null;

  const mask = (text: string) => splitByWord(text, target).map((p, i) => !p.hit ? <span key={i}>{p.text}</span>
    : <b key={i} className={done ? (phase === "correct" ? "text-green-600" : "text-amber-600") : "text-red-600"}>{done ? p.text : "*".repeat(p.text.length)}</b>);

  async function check() {
    if (done) { if (timer.current) clearTimeout(timer.current); onNext(); return; }
    if (!typed.trim()) return;
    if (norm(typed) === norm(target)) {
      setPhase("correct");
      if (settings.speak) speak(target);
      setXp(await onAnswer(true));
      if (settings.auto) timer.current = setTimeout(onNext, 1800);
    } else {
      setWrong((w) => w + 1); setShake(true); setTimeout(() => setShake(false), 350);
      if (wrong + 1 >= 3 && hint < 1) setHint(1); // after three misses the first hint appears by itself
    }
  }
  async function giveUp() {
    if (done) return;
    setPhase("revealed");
    if (settings.speak) speak(target);
    await onAnswer(false);
  }
  const press = (k: string) => {
    if (k === "Enter") { void check(); return; }
    if (done) return;
    setTyped((s) => (k === "Backspace" ? s.slice(0, -1) : s.length < 30 ? s + k : s));
  };
  const shown = done ? target : typed;
  const label = (key: string) => t(key);
  const hintText = hint === 0 ? "" : hint === 1 ? t("Từ bắt đầu bằng “{a}” ({n} chữ cái).", { a: target[0] ?? "", n: target.length })
    : t("Từ bắt đầu bằng “{a}” và kết thúc bằng “{b}” ({n} chữ cái).", { a: target[0] ?? "", b: target[target.length - 1] ?? "", n: target.length });

  return (
    <div className="relative rounded-3xl border-2 border-slate-200 bg-white p-5 pb-6 text-center shadow-[0_8px_0_-2px_rgba(148,163,184,0.45)] sm:p-7 dark:border-slate-700 dark:bg-slate-900">
      <button onClick={onReport} className="absolute left-4 top-4 rounded-lg p-1.5 text-slate-400 transition hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-950" title={t("Báo lỗi từ này")} aria-label={t("Báo lỗi từ này")}>
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /><path d="M12 9v4M12 17h.01" /></svg>
      </button>

      <div className="flex justify-center"><WordPicture word={word} /></div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <h2 className={`font-extrabold text-blue-500 ${lang === "vi" ? "text-3xl" : "text-xl"}`}>{lang === "vi" ? m.translation_vi : splitByWord(m.definition, target).map((p) => (p.hit && !done ? "*".repeat(p.text.length) : p.text)).join("")}</h2>
        <span className="rounded-md border border-slate-300 bg-white px-2 py-0.5 text-xs font-semibold text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">{t(POS[m.part_of_speech] ?? "Khác")}</span>
      </div>

      <div className="mx-auto mt-3 max-w-xl space-y-2 text-sm text-slate-700 dark:text-slate-300">
        {lang === "vi" && (
          <>
            <div><p className="text-xs text-slate-500">{t("Định nghĩa Tiếng Anh:")}</p><p className="text-base">{mask(m.definition)}</p></div>
            {m.definition_vi && <div><p className="text-xs text-slate-500">{t("Định nghĩa:")}</p><p className="text-base">{m.definition_vi}</p></div>}
          </>
        )}
        {m.examples[0] && (
          <div><p className="text-xs text-slate-500">{t("Ví dụ:")}</p><p className="text-base italic">{mask(m.examples[0])}</p>
            {lang === "vi" && m.examples_vi?.[0] && <p className="text-base">{m.examples_vi[0]}</p>}</div>
        )}
      </div>

      <div className="mx-auto mt-4 flex max-w-xl items-center justify-between gap-3">
        <div className={`flex min-h-12 min-w-28 items-center justify-center rounded-2xl border-2 border-dashed px-4 font-mono text-lg font-bold tracking-widest ${phase === "correct" ? "border-green-500 bg-green-50 text-green-700 dark:bg-green-950" : phase === "revealed" ? "border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950" : "border-slate-400 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-200"}`} aria-live="polite">
          {shown ? shown + (done ? "" : "*".repeat(Math.max(0, target.length - shown.length))) : "*".repeat(target.length)}
        </div>
        <button onClick={() => setHint((h) => Math.min(2, h + 1))} disabled={done || hint >= 2}
          className="flex items-center gap-1.5 rounded-xl border-2 border-yellow-400 bg-yellow-100 px-4 py-2 text-sm font-bold text-yellow-900 transition hover:-translate-y-0.5 hover:bg-yellow-200 disabled:opacity-50 disabled:hover:translate-y-0 dark:bg-yellow-900/40 dark:text-yellow-100">
          <span aria-hidden="true">💡</span>{label("Gợi ý")}
        </button>
      </div>
      {hintText && !done && <p className="mx-auto mt-2 max-w-xl rounded-lg bg-yellow-50 px-3 py-1.5 text-sm text-yellow-900 dark:bg-yellow-950/50 dark:text-yellow-100">{hintText}</p>}

      <input ref={input} value={typed} disabled={done} inputMode={keyboard ? "none" : "text"} autoComplete="off" autoCapitalize="off" spellCheck={false} maxLength={30}
        onChange={(e) => setTyped(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void check(); } }}
        placeholder={t("Nhập từ tiếng Anh...")} aria-label={t("Nhập từ tiếng Anh...")}
        className={`mx-auto mt-4 block w-full max-w-xl rounded-xl border-2 bg-white px-4 py-3 text-center text-lg text-slate-900 outline-none transition focus:border-blue-400 dark:bg-slate-950 dark:text-slate-100 ${shake ? "animate-shake border-red-500" : "border-slate-200 dark:border-slate-700"}`} />
      <p className="mt-2 min-h-6 text-sm font-semibold" role="status">
        {phase === "correct" && <span className="text-green-600">🎉 {t("Chính xác!")}{xp > 0 ? ` +${xp} XP` : ""}</span>}
        {phase === "revealed" && <span className="text-amber-600">{t("Đáp án")}: <b>{target}</b> {word.phonetic}</span>}
        {phase === "ask" && wrong > 0 && <span className="text-red-600">{t("Chưa đúng, thử lại nhé!")}</span>}
      </p>

      <div className="mx-auto mt-2 grid max-w-xl grid-cols-2 gap-3">
        <button onClick={() => void giveUp()} disabled={done}
          className="flex items-center justify-center gap-2 rounded-xl border-b-4 border-red-700 bg-red-500 px-4 py-3 text-sm font-extrabold uppercase tracking-wide text-white shadow transition duration-200 hover:-translate-y-0.5 hover:bg-red-600 active:translate-y-0.5 active:border-b-2 disabled:opacity-40 disabled:hover:translate-y-0">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>{t("KHÔNG BIẾT")}
        </button>
        <button onClick={() => void check()} disabled={!done && !typed.trim()}
          className={`flex items-center justify-center gap-2 rounded-xl border-b-4 px-4 py-3 text-sm font-extrabold uppercase tracking-wide text-white shadow transition duration-200 hover:-translate-y-0.5 active:translate-y-0.5 active:border-b-2 disabled:hover:translate-y-0 ${!done && !typed.trim() ? "border-emerald-400 bg-emerald-300" : "border-emerald-700 bg-emerald-500 hover:bg-emerald-600"}`}>
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>{done ? t("TỪ TIẾP THEO") : t("KIỂM TRA ĐÁP ÁN")}
        </button>
      </div>

      {keyboard && <div className="mt-4"><VirtualKeyboard extra onKey={press} /></div>}
    </div>
  );
}
