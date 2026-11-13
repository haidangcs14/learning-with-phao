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
    <div className="rounded-3xl border-2 border-slate-200 bg-white p-5 text-center shadow-[0_8px_0_-2px_rgba(148,163,184,0.45)] sm:p-7 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex justify-center"><WordPicture word={word} /></div>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <h2 className={`font-extrabold text-blue-500 ${lang === "vi" ? "text-3xl" : "text-xl"}`}>{lang === "vi" ? m.translation_vi : m.definition}</h2>
        <span className="rounded-md border border-slate-300 bg-white px-2 py-0.5 text-xs font-semibold dark:border-slate-600 dark:bg-slate-800">{t(POS[m.part_of_speech] ?? "Khác")}</span>
      </div>
      {lang === "vi" && m.definition_vi && <p className="mx-auto mt-2 max-w-xl text-slate-600 dark:text-slate-300">{m.definition_vi}</p>}
      <p className="mt-3 text-sm text-slate-500">{t("Chọn từ tiếng Anh đúng:")}</p>
      <div className="mx-auto mt-2 grid max-w-xl gap-3 sm:grid-cols-2">
        {options.map((o, i) => {
          const right = answered && o === word.word, bad = answered && o === picked && o !== word.word;
          return (
            <button key={o} onClick={() => void choose(o)} disabled={answered && !right && !bad}
              className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left text-lg font-semibold transition duration-200 ${right ? "border-green-600 bg-green-100 text-green-900 dark:bg-green-900 dark:text-green-100" : bad ? "animate-shake border-red-600 bg-red-100 text-red-900 dark:bg-red-900 dark:text-red-100" : "border-slate-300 bg-white hover:-translate-y-0.5 hover:border-blue-400 hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-950 dark:hover:bg-blue-950"} ${answered && !right && !bad ? "opacity-40" : ""}`}>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-sm dark:bg-slate-800">{i + 1}</span>{o}
            </button>
          );
        })}
      </div>
      <p className="mt-3 min-h-6 text-sm font-semibold" role="status">
        {answered && picked === word.word && <span className="text-green-600">🎉 {t("Chính xác!")}{xp > 0 ? ` +${xp} XP` : ""}</span>}
        {answered && picked !== word.word && <span className="text-red-600">{t("Đáp án đúng")}: <b>{word.word}</b> {word.phonetic}</span>}
      </p>
      {answered && <button onClick={onNext} className="mt-1 rounded-xl border-b-4 border-emerald-700 bg-emerald-500 px-6 py-3 text-sm font-extrabold uppercase text-white shadow transition hover:-translate-y-0.5 hover:bg-emerald-600 active:translate-y-0.5">{t("TỪ TIẾP THEO")}</button>}
      {!answered && <p className="text-xs text-slate-400">{t("Mẹo: nhấn phím 1-4 để chọn đáp án nhanh.")}</p>}
    </div>
  );
}
