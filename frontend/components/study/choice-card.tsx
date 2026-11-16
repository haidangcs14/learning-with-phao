"use client";

import { useEffect, useMemo, useState } from "react";
import { POS, type StudySettings } from "@/components/study/utils";
import { WordPicture } from "@/components/study/word-picture";
import { useT } from "@/lib/i18n";
import { speak } from "@/lib/speech";
import { shuffle } from "@/lib/utils";
import { useLang } from "@/store/lang-store";
import type { Word } from "@/types";

/** Multiple choice: the meaning is shown, pick the right English word out of four. */
export function ChoiceCard({ word, pool, settings, onAnswer, onNext }: { word: Word; pool: Word[]; settings: StudySettings; onAnswer: (correct: boolean) => Promise<number>; onNext: () => void }) {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const [picked, setPicked] = useState<string | null>(null);
  const [xp, setXp] = useState(0);
  const m = word.meanings[0];
  const options = useMemo(() => shuffle([word.word, ...shuffle(pool.filter((w) => w.id !== word.id)).slice(0, 3).map((w) => w.word)]), [word, pool]);
  const answered = picked !== null;

  async function choose(o: string) {
    if (answered) return;
    setPicked(o);
    const ok = o === word.word;
    if (ok && settings.speak) speak(word.word);
    setXp(await onAnswer(ok));
    if (ok && settings.auto) setTimeout(onNext, 1500);
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (answered) { if (e.key === "Enter") onNext(); return; }
      const o = options[Number(e.key) - 1];
      if (o) void choose(o);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }); // eslint-disable-line react-hooks/exhaustive-deps
  if (!m) return null;

  return (
    <div className="rounded-card border-2 border-border bg-surface p-5 text-center shadow-raised sm:p-7">
      <div className="flex justify-center"><WordPicture word={word} /></div>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <h2 className={`font-bold text-secondary-text ${lang === "vi" ? "text-3xl" : "text-xl"}`}>{lang === "vi" ? m.translation_vi : m.definition}</h2>
        <span className="rounded-md border border-border bg-surface px-2 py-0.5 text-xs font-semibold">{t(POS[m.part_of_speech] ?? "Khác")}</span>
      </div>
      {lang === "vi" && m.definition_vi && <p className="mx-auto mt-2 max-w-xl text-muted-foreground">{m.definition_vi}</p>}
      <p className="mt-3 text-sm text-muted-foreground">{t("Chọn từ tiếng Anh đúng:")}</p>
      <div className="mx-auto mt-2 grid max-w-xl gap-3 sm:grid-cols-2">
        {options.map((o, i) => {
          const right = answered && o === word.word, bad = answered && o === picked && o !== word.word;
          return (
            <button key={o} onClick={() => void choose(o)} disabled={answered && !right && !bad}
              className={`flex items-center gap-3 rounded-btn border-2 px-4 py-3 text-left text-lg font-semibold transition duration-200 ${right ? "border-success bg-success-soft text-success-text" : bad ? "animate-shake border-error bg-error-soft text-error-text" : "border-border bg-surface hover:-translate-y-0.5 hover:border-secondary hover:bg-secondary-soft"} ${answered && !right && !bad ? "opacity-40" : ""}`}>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-btn bg-surface-secondary text-sm">{i + 1}</span>{o}
            </button>
          );
        })}
      </div>
      <p className="mt-3 min-h-6 text-sm font-semibold" role="status">
        {answered && picked === word.word && <span className="text-success-text">🎉 {t("Chính xác!")}{xp > 0 ? ` +${xp} XP` : ""}</span>}
        {answered && picked !== word.word && <span className="text-error-text">{t("Đáp án đúng")}: <b>{word.word}</b> {word.phonetic}</span>}
      </p>
      {answered && <button onClick={onNext} className="mt-1 rounded-btn border-b-4 border-primary bg-primary px-6 py-3 text-sm font-bold uppercase text-primary-foreground shadow transition hover:-translate-y-0.5 hover:bg-primary-hover active:translate-y-0.5">{t("TỪ TIẾP THEO")}</button>}
      {!answered && <p className="text-xs text-muted-foreground">{t("Mẹo: nhấn phím 1-4 để chọn đáp án nhanh.")}</p>}
    </div>
  );
}
