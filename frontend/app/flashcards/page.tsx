"use client";

import { useEffect, useRef, useState } from "react";
import { FlipCard } from "@/components/flip-card";
import { Protected } from "@/components/protected";
import { Button, Empty, ErrorBox, Page, Spinner } from "@/components/ui";
import { useGet, useSend } from "@/hooks/api";
import { useT } from "@/lib/i18n";
import { useLang } from "@/store/lang-store";
import { speak } from "@/lib/utils";
import type { Card as FlashCard } from "@/types";

const RATINGS = [["again", "Quên", "danger"], ["hard", "Khó", "ghost"], ["good", "Tốt", "primary"], ["easy", "Dễ", "ghost"]] as const;

function Flashcards() {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const due = useGet<FlashCard[]>("/flashcards/due?limit=20");
  const review = useSend<unknown, { word_id: string; rating: string }>("POST", "/flashcards/review");
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const busy = useRef(false);
  const cards = due.data?.data ?? [];
  const card = cards[i];

  function rate(rating: string) {
    if (!card || busy.current) return;
    busy.current = true;
    review.mutate({ word_id: card.word_id, rating }, {
      onSuccess: () => {
        setFlipped(false); // flip back first, then swap the content once the card is face-down
        setTimeout(() => { setI((n) => n + 1); busy.current = false; }, 350);
      },
      onError: () => { busy.current = false; },
    });
  }

  useEffect(() => { // keyboard: Space = flip, 1-4 = rate
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT") return;
      if (e.key === " ") { e.preventDefault(); setFlipped((f) => !f); }
      const r = RATINGS[Number(e.key) - 1];
      if (r && flipped) rate(r[0]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (due.isLoading) return <Spinner />;
  if (due.error) return <ErrorBox error={due.error} />;
  if (!card) {
    return (
      <Empty>
        {cards.length === 0 ? t("Chưa có thẻ cần ôn. Hãy thêm từ vào flashcard ở trang Từ vựng.") : t("🎉 Bạn đã ôn xong lượt này!")}
        <div className="mt-3"><Button onClick={() => { setI(0); setFlipped(false); void due.refetch(); }}>{t("Tải lại")}</Button></div>
      </Empty>
    );
  }
  const w = card.word;
  const m = w.meanings[0];
  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
        <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${(i / cards.length) * 100}%` }} />
      </div>
      <p className="text-center text-sm text-slate-500">{t("Thẻ {i} / {n}", { i: i + 1, n: cards.length })}</p>
      <FlipCard flipped={flipped} onFlip={() => setFlipped(!flipped)} label={t("Bấm để lật thẻ")}
        front={<>
          <p className="text-4xl font-bold">{w.word}</p>
          <p className="text-slate-500">{w.phonetic}</p>
          <button className="mt-2 rounded-full border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800"
            onClick={(e) => { e.stopPropagation(); speak(w.word); }}>🔊 {t("Nghe")}</button>
          <p className="mt-2 text-xs text-slate-400">{t("Bấm để lật thẻ")} · Space</p>
        </>}
        back={<>
          <p className="text-2xl font-semibold">{lang === "en" ? m?.definition : m?.translation_vi}</p>
          {lang === "vi" && <p className="text-sm">{m?.definition}</p>}
          <p className="text-sm italic text-slate-500 dark:text-slate-400">{m?.examples[0]}</p>
        </>} />
      {review.error && <ErrorBox error={review.error} />}
      <div className={`grid grid-cols-4 gap-2 transition-opacity ${flipped ? "opacity-100" : "pointer-events-none opacity-30"}`}>
        {RATINGS.map(([k, label, v], idx) => (
          <Button key={k} variant={v} disabled={review.isPending || !flipped} onClick={() => rate(k)}>
            {t(label)} <span className="text-[10px] opacity-60">{idx + 1}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}

export default function FlashcardsPage() {
  const t = useT();
  return <Protected><Page title={t("Flashcard")}><Flashcards /></Page></Protected>;
}
