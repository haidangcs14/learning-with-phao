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
    : <b key={i} className={done ? (phase === "correct" ? "text-success-text" : "text-accent-text") : "text-error-text"}>{done ? p.text : "*".repeat(p.text.length)}</b>);

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
    <div className="relative rounded-card border-2 border-border bg-surface p-5 pb-6 text-center shadow-raised sm:p-7">
      <button onClick={onReport} className="absolute left-4 top-4 rounded-btn p-1.5 text-muted-foreground transition hover:bg-accent-soft hover:text-accent-text" title={t("Báo lỗi từ này")} aria-label={t("Báo lỗi từ này")}>
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /><path d="M12 9v4M12 17h.01" /></svg>
      </button>

      <div className="flex justify-center"><WordPicture word={word} /></div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <h2 className={`font-bold text-secondary-text ${lang === "vi" ? "text-3xl" : "text-xl"}`}>{lang === "vi" ? m.translation_vi : splitByWord(m.definition, target).map((p) => (p.hit && !done ? "*".repeat(p.text.length) : p.text)).join("")}</h2>
        <span className="rounded-md border border-border bg-surface px-2 py-0.5 text-xs font-semibold text-foreground">{t(POS[m.part_of_speech] ?? "Khác")}</span>
      </div>

      <div className="mx-auto mt-3 max-w-xl space-y-2 text-sm text-foreground">
        {lang === "vi" && (
          <>
            <div><p className="text-xs text-muted-foreground">{t("Định nghĩa Tiếng Anh:")}</p><p className="text-base">{mask(m.definition)}</p></div>
            {m.definition_vi && <div><p className="text-xs text-muted-foreground">{t("Định nghĩa:")}</p><p className="text-base">{m.definition_vi}</p></div>}
          </>
        )}
        {m.examples[0] && (
          <div><p className="text-xs text-muted-foreground">{t("Ví dụ:")}</p><p className="text-base italic">{mask(m.examples[0])}</p>
            {lang === "vi" && m.examples_vi?.[0] && <p className="text-base">{m.examples_vi[0]}</p>}</div>
        )}
      </div>

      <div className="mx-auto mt-4 flex max-w-xl items-center justify-between gap-3">
        <div className={`flex min-h-12 min-w-28 items-center justify-center rounded-2xl border-2 border-dashed px-4 font-mono text-lg font-bold tracking-widest ${phase === "correct" ? "border-success bg-success-soft text-success-text" : phase === "revealed" ? "border-accent bg-accent-soft text-accent-text" : "border-border bg-surface-secondary text-muted-foreground"}`} aria-live="polite">
          {shown ? shown + (done ? "" : "*".repeat(Math.max(0, target.length - shown.length))) : "*".repeat(target.length)}
        </div>
        <button onClick={() => setHint((h) => Math.min(2, h + 1))} disabled={done || hint >= 2}
          className="flex items-center gap-1.5 rounded-btn border-2 border-accent bg-accent-soft px-4 py-2 text-sm font-bold text-accent-text transition hover:-translate-y-0.5 hover:bg-accent-soft disabled:opacity-50 disabled:hover:translate-y-0">
          <span aria-hidden="true">💡</span>{label("Gợi ý")}
        </button>
      </div>
      {hintText && !done && <p className="mx-auto mt-2 max-w-xl rounded-btn bg-accent-soft px-3 py-1.5 text-sm text-accent-text">{hintText}</p>}

      <input ref={input} value={typed} disabled={done} inputMode={keyboard ? "none" : "text"} autoComplete="off" autoCapitalize="off" spellCheck={false} maxLength={30}
        onChange={(e) => setTyped(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void check(); } }}
        placeholder={t("Nhập từ tiếng Anh...")} aria-label={t("Nhập từ tiếng Anh...")}
        className={`mx-auto mt-4 block w-full max-w-xl rounded-btn border-2 bg-surface px-4 py-3 text-center text-lg text-foreground outline-none transition focus:border-secondary ${shake ? "animate-shake border-error" : "border-border"}`} />
      <p className="mt-2 min-h-6 text-sm font-semibold" role="status">
        {phase === "correct" && <span className="text-success-text">🎉 {t("Chính xác!")}{xp > 0 ? ` +${xp} XP` : ""}</span>}
        {phase === "revealed" && <span className="text-accent-text">{t("Đáp án")}: <b>{target}</b> {word.phonetic}</span>}
        {phase === "ask" && wrong > 0 && <span className="text-error-text">{t("Chưa đúng, thử lại nhé!")}</span>}
      </p>

      <div className="mx-auto mt-2 grid max-w-xl grid-cols-2 gap-3">
        <button onClick={() => void giveUp()} disabled={done}
          className="flex items-center justify-center gap-2 rounded-btn border-b-4 border-error bg-error px-4 py-3 text-sm font-bold uppercase tracking-wide text-error-foreground shadow transition duration-200 hover:-translate-y-0.5 hover:bg-error active:translate-y-0.5 active:border-b-2 disabled:opacity-40 disabled:hover:translate-y-0">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>{t("KHÔNG BIẾT")}
        </button>
        <button onClick={() => void check()} disabled={!done && !typed.trim()}
          className={`flex items-center justify-center gap-2 rounded-btn border-b-4 px-4 py-3 text-sm font-bold uppercase tracking-wide text-primary-foreground shadow transition duration-200 hover:-translate-y-0.5 active:translate-y-0.5 active:border-b-2 disabled:hover:translate-y-0 ${!done && !typed.trim() ? "border-primary bg-primary" : "border-primary bg-primary hover:bg-primary-hover"}`}>
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>{done ? t("TỪ TIẾP THEO") : t("KIỂM TRA ĐÁP ÁN")}
        </button>
      </div>

      {keyboard && <div className="mt-4"><VirtualKeyboard extra onKey={press} /></div>}
    </div>
  );
}
