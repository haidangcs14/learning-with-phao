// Vietnamese text is the translation key (English in lib/i18n.ts).
export const POS: Record<string, string> = {
  noun: "Danh từ", verb: "Động từ", adjective: "Tính từ", adverb: "Trạng từ", preposition: "Giới từ", pronoun: "Đại từ",
  conjunction: "Liên từ", interjection: "Thán từ", determiner: "Hạn định từ", phrase: "Cụm từ", other: "Khác",
  phrasal_verb: "Cụm động từ", idiom: "Thành ngữ", collocation: "Kết hợp từ", modal_verb: "Động từ khuyết thiếu",
};
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Splits a sentence around the target word (and its endings: abandon → abandoned) so the word can be hidden or highlighted. */
export function splitByWord(text: string, word: string): { text: string; hit: boolean }[] {
  const parts = text.split(new RegExp(`(\\b${esc(word)}\\w*)`, "gi"));
  return parts.map((p, i) => ({ text: p, hit: i % 2 === 1 })).filter((p) => p.text !== "");
}
/** Compares answers ignoring case, spaces and hyphens. */
export const norm = (s: string) => s.toLowerCase().replace(/[^a-z']/g, "");

const TINTS = ["from-secondary-soft to-primary-soft", "from-accent-soft to-primary-soft", "from-primary-soft to-secondary-soft", "from-success-soft to-secondary-soft", "from-accent-soft to-success-soft", "from-secondary-soft to-accent-soft"];
export function tint(key: string): string {
  let h = 0;
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return TINTS[h % TINTS.length] as string;
}
export interface StudySettings { auto: boolean; speak: boolean }
export const DEFAULT_STUDY: StudySettings = { auto: true, speak: true };
