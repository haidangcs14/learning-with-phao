/* eslint-disable @next/next/no-img-element */
import type { Word } from "@/types";

/** Illustration of a word: the teacher's image if there is one, otherwise the emoji. */
export function WordVisual({ word, size = "md" }: { word: Pick<Word, "word" | "emoji" | "image_url">; size?: "sm" | "md" | "lg" }) {
  const box = { sm: "h-12 w-12 text-3xl", md: "h-24 w-24 text-6xl", lg: "h-40 w-40 text-8xl" }[size];
  if (word.image_url) return <img src={word.image_url} alt={word.word} loading="lazy" className={`${box} rounded-xl object-cover`} />;
  if (word.emoji) return <span role="img" aria-label={word.word} className={`${box} flex items-center justify-center`}>{word.emoji}</span>;
  return null;
}
