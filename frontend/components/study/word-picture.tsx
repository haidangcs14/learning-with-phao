/* eslint-disable @next/next/no-img-element */
import { tint } from "@/components/study/utils";
import type { Word } from "@/types";

/** The 125 x 125 illustration of a card: the teacher's image if there is one, otherwise the emoji on a soft gradient. */
export function WordPicture({ word, size = 125 }: { word: Pick<Word, "word" | "emoji" | "image_url">; size?: number }) {
  const box = { width: size, height: size };
  const frame = "rounded-2xl border-4 border-surface shadow-lg shadow-border/70";
  if (word.image_url) return <img src={word.image_url} alt="" style={box} className={`${frame} object-cover`} />;
  return <span style={{ ...box, fontSize: size * 0.55 }} role="img" aria-label={word.word} className={`${frame} flex items-center justify-center bg-gradient-to-br ${tint(word.word)}`}>{word.emoji || "📘"}</span>;
}
