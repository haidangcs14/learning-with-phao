import type { Word } from "@/types";

export interface Owner { id: string; username: string; full_name: string; avatar_url: string }
export interface SetSummary {
  id: string; title: string; description: string; emoji: string; status: "draft" | "public"; owner: Owner | null;
  group_count: number; card_count: number; position: number; created_at: string; updated_at: string; published_at: string | null;
}
export interface SetGroup { id: string; title: string; count: number }
export interface SetDetail extends SetSummary { is_owner: boolean; groups: SetGroup[] }
export interface SetCard {
  id: string; set_id: string; group_id: string; word: string; phonetic: string; translation: string; pos: string;
  definition_en: string; definition_vi: string; example_en: string; example_vi: string; position: number;
}

/** Part-of-speech choices of the card form (keys are stored in the database; labels are translated). */
export const POS_CHOICES = [
  ["noun", "Danh từ"], ["verb", "Động từ"], ["adjective", "Tính từ"], ["adverb", "Trạng từ"], ["preposition", "Giới từ"], ["pronoun", "Đại từ"],
  ["conjunction", "Liên từ"], ["determiner", "Từ hạn định"], ["interjection", "Thán từ"], ["phrasal_verb", "Cụm động từ"], ["idiom", "Thành ngữ"],
  ["phrase", "Cụm từ"], ["collocation", "Kết hợp từ"], ["modal_verb", "Động từ khuyết thiếu"],
] as const;

/** Lets the study cards (built for dictionary words) show a user-made card too. */
export function cardToWord(c: SetCard): Word {
  return {
    id: c.id, word: c.word, slug: "", phonetic: c.phonetic, level: "", topics: [], synonyms: [], antonyms: [], collocations: [], emoji: "", image_url: "",
    meanings: [{ part_of_speech: c.pos || "other", definition: c.definition_en, definition_vi: c.definition_vi, translation_vi: c.translation,
      examples: c.example_en ? [c.example_en] : [], examples_vi: c.example_vi ? [c.example_vi] : [] }],
  } as unknown as Word;
}
