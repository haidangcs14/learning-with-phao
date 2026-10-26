export type Mode = "easy" | "normal" | "hard";
export const MODES: Mode[] = ["easy", "normal", "hard"];

export interface Settings {
  ratio: Record<Mode, number>; // share of words hidden per mode (0..1)
  hints: boolean;              // clicking a hidden word shows its first letter and length
  autoPause: boolean;          // pause at the end of each sentence
}
export const DEFAULT_SETTINGS: Settings = { ratio: { easy: 0.2, normal: 0.4, hard: 0.6 }, hints: true, autoPause: true };
const KEY = "dictation.settings";

export function loadSettings(): Settings {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<Settings> | null;
    return raw ? { ...DEFAULT_SETTINGS, ...raw, ratio: { ...DEFAULT_SETTINGS.ratio, ...(raw.ratio ?? {}) } } : DEFAULT_SETTINGS;
  } catch { return DEFAULT_SETTINGS; }
}
export function saveSettings(s: Settings): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage blocked */ }
}

/** The words of a sentence (same tokenisation as the server: punctuation and case are not part of a word). */
export function wordsOf(text: string): string[] {
  return text.replace(/[\u2018\u2019]/g, "'").match(/[A-Za-z0-9]+(?:['-][A-Za-z0-9]+)*/g) ?? [];
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Which words are hidden. Deterministic (same lesson + sentence + mode = same words), so nothing jumps around when the page re-renders. */
export function maskedIndexes(lessonId: string, no: number, mode: Mode, count: number, ratio: number): Set<number> {
  if (count < 2 || ratio <= 0) return new Set();
  const take = Math.min(count, Math.max(1, Math.round(count * ratio)));
  const rand = mulberry32(hash(`${lessonId}:${no}:${mode}`));
  const order = Array.from({ length: count }, (_, i) => i);
  for (let i = count - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [order[i], order[j]] = [order[j] as number, order[i] as number]; }
  return new Set(order.slice(0, take));
}

export const mmss = (sec: number): string => {
  const s = Math.max(0, Math.floor(sec || 0));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

const YT_ID = /^[A-Za-z0-9_-]{11}$/;
/** Quick client-side check; the server validates again. */
export function looksLikeYouTube(url: string): boolean {
  const u = url.trim();
  if (YT_ID.test(u)) return true;
  try {
    const p = new URL(u.includes("://") ? u : `https://${u}`);
    const host = p.hostname.replace(/^(www|m)\./, "");
    if (host === "youtu.be") return YT_ID.test(p.pathname.split("/")[1] ?? "");
    if (host === "youtube.com" || host === "youtube-nocookie.com" || host === "music.youtube.com") {
      const parts = p.pathname.split("/").filter(Boolean);
      return YT_ID.test(p.pathname === "/watch" ? p.searchParams.get("v") ?? "" : parts[1] ?? "") && (p.pathname === "/watch" || ["embed", "shorts", "live", "v"].includes(parts[0] ?? ""));
    }
  } catch { /* not a URL */ }
  return false;
}
