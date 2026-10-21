"use client";

import { useEffect, useState } from "react";
import { CATEGORY, GROUP_VIDEOS, SOURCE_URL, TIPS } from "@/lib/ipa-extra";
import { useT } from "@/lib/i18n";
import { speak } from "@/lib/utils";
import { useLang } from "@/store/lang-store";

export interface Phoneme {
  id: string; symbol: string; type: "vowel" | "diphthong" | "consonant"; category: string;
  voiced: "true" | "false" | ""; description: string; example_words: string[];
}

const TYPE_LABEL = { vowel: "Nguyên âm", diphthong: "Nguyên âm đôi", consonant: "Phụ âm" } as const;
const btn = "flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800";

export function IpaModal({ items, index, onClose, onIndex }:
  { items: Phoneme[]; index: number; onClose: () => void; onIndex: (i: number) => void }) {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const [play, setPlay] = useState(false);
  const p = items[index];
  const n = items.length;

  useEffect(() => setPlay(false), [index]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onIndex((index + 1) % n);
      if (e.key === "ArrowLeft") onIndex((index - 1 + n) % n);
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden"; // lock page scroll while the modal is open
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [index, n, onClose, onIndex]);

  if (!p) return null;
  const video = GROUP_VIDEOS[p.type];
  const tip = TIPS[p.symbol];
  const search = `https://www.youtube.com/results?search_query=${encodeURIComponent(`how to pronounce /${p.symbol}/ english sound`)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={`/${p.symbol}/`} onClick={(e) => e.stopPropagation()}
        className="animate-modal max-h-[92vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-t-2xl bg-white p-5 text-slate-900 shadow-2xl sm:rounded-2xl dark:bg-slate-900 dark:text-slate-100">
        <div className="flex items-center justify-between">
          <button className={btn} onClick={() => onIndex((index - 1 + n) % n)} aria-label={t("Âm trước")}>←</button>
          <div className="text-center">
            <p className="text-5xl font-bold text-indigo-600 dark:text-indigo-400">/{p.symbol}/</p>
            <p className="mt-1 text-xs text-slate-500">{index + 1} / {n}</p>
          </div>
          <div className="flex gap-2">
            <button className={btn} onClick={() => onIndex((index + 1) % n)} aria-label={t("Âm sau")}>→</button>
            <button className={btn} onClick={onClose} aria-label={t("Đóng")}>✕</button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-indigo-100 px-3 py-1 text-indigo-800">{t(TYPE_LABEL[p.type])}</span>
          {CATEGORY[p.category] && <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700 dark:bg-slate-800 dark:text-slate-200">{t(CATEGORY[p.category] as string)}</span>}
          {p.voiced === "true" && <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-800">{t("Hữu thanh (rung dây thanh)")}</span>}
          {p.voiced === "false" && <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-800">{t("Vô thanh (không rung)")}</span>}
        </div>

        {lang === "vi" && <p className="text-sm text-slate-600 dark:text-slate-300">{p.description}</p>}
        {tip && (
          <div className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800/60">
            <p className="mb-1 font-semibold">{t("Cách phát âm")}</p>
            <p>{tip[lang]}</p>
          </div>
        )}

        <div>
          <p className="mb-2 text-sm font-semibold">{t("Từ ví dụ")}</p>
          <div className="flex flex-wrap gap-2">
            {p.example_words.map((w) => (
              <button key={w} onClick={() => speak(w)}
                className="rounded-full bg-indigo-50 px-3 py-1.5 text-sm text-indigo-800 hover:bg-indigo-100 dark:bg-indigo-950 dark:text-indigo-200">
                🔊 {w}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold">{t("Video hướng dẫn")}</p>
          <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
            {play ? (
              <iframe className="absolute inset-0 h-full w-full" title={`IPA ${p.type}`} allowFullScreen
                src={`https://www.youtube-nocookie.com/embed/${video}?autoplay=1&rel=0`}
                allow="accelerometer; autoplay; encrypted-media; picture-in-picture" />
            ) : (
              <button className="group absolute inset-0 flex items-center justify-center" onClick={() => setPlay(true)} aria-label={t("Phát video")}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`https://i.ytimg.com/vi/${video}/hqdefault.jpg`} alt="" className="absolute inset-0 h-full w-full object-cover opacity-80" />
                <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-red-600 text-2xl text-white transition group-hover:scale-110">▶</span>
              </button>
            )}
          </div>
          <p className="mt-2 text-xs text-slate-500">{t("Video chung cho nhóm âm này.")}</p>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs">
            <a className="text-indigo-600 underline" target="_blank" rel="noreferrer" href={search}>{t("Tìm video riêng cho âm /{s}/", { s: p.symbol })}</a>
            <a className="text-indigo-600 underline" target="_blank" rel="noreferrer" href={SOURCE_URL}>{t("Nguồn tham khảo: ZIM Academy")}</a>
          </div>
        </div>
      </div>
    </div>
  );
}
