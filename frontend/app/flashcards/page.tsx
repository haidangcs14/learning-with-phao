"use client";

import { useEffect, useRef, useState } from "react";
import { FlipCard } from "@/components/flip-card";
import { Protected } from "@/components/protected";
import { Swipeable } from "@/components/swipeable";
import { Button, Empty, ErrorBox, Page, Spinner } from "@/components/ui";
import { useGet, useSend } from "@/hooks/api";
import { useT } from "@/lib/i18n";
import { WordVisual } from "@/components/word-visual";
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
  const [rated, setRated] = useState<Set<string>>(new Set()); // cards already rated in this session
  const busy = useRef(false);
  const cards = due.data?.data ?? [];
  const card = cards[i];
  const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

  /** Goes to card n. A flipped card is turned face-down first so the answer of the new card never flashes. */
  async function show(n: number) {
    if (busy.current || n < 0 || n >= cards.length || n === i) return;
    busy.current = true;
    if (flipped) { setFlipped(false); await wait(350); }
    setI(n);
    busy.current = false;
  }

  function rate(rating: string) {
    if (!card || busy.current || rated.has(card.word_id)) return;
    busy.current = true;
    review.mutate({ word_id: card.word_id, rating }, {
      onSuccess: () => {
        const next = new Set(rated).add(card.word_id);
        setRated(next);
        setFlipped(false); // flip back first, then swap the content once the card is face-down
        setTimeout(() => {
          for (let k = 1; k <= cards.length; k++) { // the next card that has not been rated yet (cards you swiped past stay in the deck)
            const j = (i + k) % cards.length;
            if (!next.has(cards[j]?.word_id ?? "")) { setI(j); break; }
          }
          busy.current = false;
        }, 350);
      },
      onError: () => { busy.current = false; },
    });
  }

  useEffect(() => { // keyboard: Space = flip, 1-4 = rate, ← → = previous / next card
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT") return;
      if (e.key === " ") { e.preventDefault(); setFlipped((f) => !f); }
      if (e.key === "ArrowRight") void show(i + 1);
      if (e.key === "ArrowLeft") void show(i - 1);
      const r = RATINGS[Number(e.key) - 1];
      if (r && flipped) rate(r[0]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (due.isLoading) return <Spinner />;
  if (due.error) return <ErrorBox error={due.error} />;
  if (!card || rated.size >= cards.length) {
    return (
      <Empty>
        {cards.length === 0 ? t("Chưa có thẻ cần ôn. Hãy thêm từ vào flashcard ở trang Từ vựng.") : t("🎉 Bạn đã ôn xong lượt này!")}
        <div className="mt-3"><Button onClick={() => { setI(0); setFlipped(false); setRated(new Set()); void due.refetch(); }}>{t("Tải lại")}</Button></div>
      </Empty>
    );
  }
  const w = card.word;
  const m = w.meanings[0];
  const done = rated.has(card.word_id);
  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="h-2 overflow-hidden rounded-full bg-border">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(rated.size / cards.length) * 100}%` }} />
      </div>
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" onClick={() => void show(i - 1)} disabled={i === 0} aria-label={t("Thẻ trước")}>‹</Button>
        <p className="text-center text-sm text-muted-foreground" aria-live="polite">{t("Thẻ {i} / {n}", { i: i + 1, n: cards.length })}{done && <span className="ml-2 font-semibold text-success-text">✓ {t("Đã ôn")}</span>}</p>
        <Button variant="ghost" onClick={() => void show(i + 1)} disabled={i >= cards.length - 1} aria-label={t("Thẻ sau")}>›</Button>
      </div>
      <Swipeable canPrev={i > 0} canNext={i < cards.length - 1} onSwipe={(dir) => show(dir === "next" ? i + 1 : i - 1)}>
        <FlipCard flipped={flipped} onFlip={() => setFlipped(!flipped)} label={t("Bấm để lật thẻ")}
          front={<>
            <WordVisual word={w} size="md" />
            <p className="text-4xl font-bold">{w.word}</p>
            <p className="text-muted-foreground">{w.phonetic}</p>
            <button className="mt-2 rounded-full border border-border px-3 py-1 text-sm hover:bg-surface-secondary"
              onClick={(e) => { e.stopPropagation(); speak(w.word); }}>🔊 {t("Nghe")}</button>
            <p className="mt-2 text-xs text-muted-foreground">{t("Bấm để lật thẻ")} · Space</p>
          </>}
          back={<>
            <p className="text-2xl font-semibold">{lang === "en" ? m?.definition : m?.translation_vi}</p>
            {lang === "vi" && m?.definition_vi ? <p className="text-sm">{m.definition_vi}</p> : null}
            {lang === "vi" && <p className="text-xs text-muted-foreground">{m?.definition}</p>}
            <p className="text-sm italic text-muted-foreground">{m?.examples[0]}</p>
            {lang === "vi" && m?.examples_vi?.[0] ? <p className="text-sm italic text-muted-foreground">{m.examples_vi[0]}</p> : null}
          </>} />
      </Swipeable>
      <p className="text-center text-xs text-muted-foreground">↔ {t("Vuốt sang trái/phải (hoặc phím ← →) để đổi thẻ")}</p>
      {review.error && <ErrorBox error={review.error} />}
      <div className={`grid grid-cols-4 gap-2 transition-opacity ${flipped && !done ? "opacity-100" : "pointer-events-none opacity-30"}`}>
        {RATINGS.map(([k, label, v], idx) => (
          <Button key={k} variant={v} disabled={review.isPending || !flipped || done} onClick={() => rate(k)}>
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
