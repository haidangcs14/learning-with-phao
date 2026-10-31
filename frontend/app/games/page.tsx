"use client";

import Link from "next/link";
import { Protected } from "@/components/protected";
import { Page } from "@/components/ui";
import { useGet } from "@/hooks/api";
import { useT } from "@/lib/i18n";

// Vietnamese text is the translation key (English in lib/i18n.ts).
const GAMES = [
  { slug: "matching", id: "card_matching", icon: "🃏", name: "Card Matching", color: "from-pink-500 to-rose-500", tags: ["Memory", "Classic"],
    desc: "Lật thẻ ghi nhớ hoặc ghép cặp từ với nghĩa. Càng ít lượt lật và càng nhanh thì điểm càng cao." },
  { slug: "fill-blank", id: "fill_blank", icon: "✏️", name: "Điền vào chỗ trống", color: "from-cyan-500 to-sky-600", tags: ["Quiz"],
    desc: "Chọn từ đúng để điền vào chỗ trống trong câu. Đáp án đúng hiện màu xanh, sai hiện màu đỏ." },
  { slug: "word-bridge", id: "word_bridge", icon: "🌉", name: "Word Bridge", color: "from-emerald-500 to-teal-600", tags: ["3D", "Sentence"],
    desc: "Xếp các từ thành câu hoàn chỉnh: mỗi từ đúng dựng một nhịp cầu để avatar của bạn bước sang bờ bên kia. Sai 5 lần là rơi xuống sông!" },
  { slug: "vocab-rain", id: "vocab_rain", icon: "🌧️", name: "Vocabulary Rain", color: "from-indigo-600 to-blue-800", tags: ["Arcade", "Typing"],
    desc: "Từ vựng rơi như mưa: gõ đúng từ tiếng Anh theo nghĩa tiếng Việt trước khi chúng chạm đất. Combo càng cao điểm càng lớn." },
] as const;

export default function GamesPage() {
  const t = useT();
  const best = useGet<Record<string, number | null>>("/games/summary");
  return (
    <Protected>
      <Page title={t("Trò chơi")}>
        <p className="text-slate-500 dark:text-slate-400">{t("Chọn một trò chơi và bấm Bắt đầu.")}</p>
        <ul className="space-y-3">
          {GAMES.map((g) => {
            const score = best.data?.data[g.id];
            return (
              <li key={g.id} className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-indigo-400 hover:shadow-md sm:flex-row sm:items-center dark:border-slate-800 dark:bg-slate-900/60">
                <span className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-4xl shadow ${g.color}`} aria-hidden="true">{g.icon}</span>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-bold">{t(g.name)}</h2>
                    {g.tags.map((tag) => <span key={tag} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium dark:bg-slate-800">{tag}</span>)}
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300">{t(g.desc)}</p>
                  {score != null && <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">🏆 {t("Điểm cao nhất")}: {score}</p>}
                </div>
                <Link href={`/games/${g.slug}`} className="shrink-0 rounded-xl bg-indigo-600 px-6 py-3 text-center font-bold text-white shadow transition hover:bg-indigo-700">▶ {t("Bắt đầu")}</Link>
              </li>
            );
          })}
        </ul>
      </Page>
    </Protected>
  );
}
