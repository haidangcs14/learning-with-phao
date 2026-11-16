"use client";

import Link from "next/link";
import { useState } from "react";
import { Avatar } from "@/components/avatar";
import { Protected } from "@/components/protected";
import { Page, Spinner } from "@/components/ui";
import { useGet } from "@/hooks/api";
import { useT } from "@/lib/i18n";
import { useAuth } from "@/store/auth-store";

// Vietnamese text is the translation key (English in lib/i18n.ts).
const GAMES = [
  { slug: "matching", id: "card_matching", icon: "🃏", name: "Card Matching", color: "from-accent to-primary", tags: ["Memory", "Classic"],
    desc: "Lật thẻ ghi nhớ hoặc ghép cặp từ với nghĩa. Càng ít lượt lật và càng nhanh thì điểm càng cao." },
  { slug: "fill-blank", id: "fill_blank", icon: "✏️", name: "Điền vào chỗ trống", color: "from-secondary to-secondary", tags: ["Quiz"],
    desc: "Chọn từ đúng để điền vào chỗ trống trong câu. Đáp án đúng hiện màu xanh, sai hiện màu đỏ." },
  { slug: "word-bridge", id: "word_bridge", icon: "🌉", name: "Word Bridge", color: "from-primary to-primary-hover", tags: ["3D", "Sentence"],
    desc: "Xếp các từ thành câu hoàn chỉnh: mỗi từ đúng dựng một nhịp cầu để avatar của bạn bước sang bờ bên kia. Sai 5 lần là rơi xuống sông!" },
  { slug: "vocab-rain", id: "vocab_rain", icon: "🌧️", name: "Vocabulary Rain", color: "from-primary to-secondary-hover", tags: ["Arcade", "Typing"],
    desc: "Từ vựng rơi như mưa: gõ đúng từ tiếng Anh theo nghĩa tiếng Việt trước khi chúng chạm đất. Combo càng cao điểm càng lớn." },
  { slug: "word-guess", id: "word_guess", icon: "🔤", name: "Đoán Từ", color: "from-accent to-secondary", tags: ["Wordle", "Streak"],
    desc: "Wordle dựng trên chính vốn từ của bạn: đọc nghĩa, xem số chữ cái và ghép đúng từ trong sáu lượt. Xanh, vàng, xám sẽ thu hẹp dần đáp án." },
] as const;
const NAME: Record<string, string> = Object.fromEntries(GAMES.map((g) => [g.id, g.name]));

interface Act { user_id: string; name: string; username: string; avatar_url: string; game: string; game_name: string; score: number; correct: number; record: boolean; created_at: string }
interface Rank { rank: number; user_id: string; name: string; username: string; avatar_url: string; level: number; score: number; games: number }

function ago(iso: string, t: ReturnType<typeof useT>): string {
  const s = Math.max(0, (Date.now() - new Date(iso.endsWith("Z") ? iso : `${iso}Z`).getTime()) / 1000);
  if (s < 60) return t("Vừa xong");
  if (s < 3600) return t("{n} phút trước", { n: Math.floor(s / 60) });
  if (s < 86400) return t("{n} giờ trước", { n: Math.floor(s / 3600) });
  return t("{n} ngày trước", { n: Math.floor(s / 86400) });
}

function Activity() {
  const t = useT();
  const q = useGet<Act[]>("/games/activity?limit=12");
  const rows = q.data?.data ?? [];
  return (
    <section className="rounded-card border border-border bg-surface p-4 shadow-raised">
      <h2 className="mb-3 font-bold">⚡ {t("Hoạt động gần đây")}</h2>
      {q.isLoading ? <Spinner /> : rows.length === 0 ? <p className="text-sm text-muted-foreground">{t("Chưa có ai chơi. Hãy là người đầu tiên!")}</p> : (
        <ul className="space-y-2.5">
          {rows.map((a, i) => (
            <li key={`${a.user_id}-${a.created_at}-${i}`} className="flex items-start gap-2.5 text-sm">
              <Avatar user={{ username: a.username, avatar_url: a.avatar_url }} size={30} />
              <div className="min-w-0 flex-1">
                <p>{a.record
                  ? <>🏆 <b>{a.name}</b> {t("đạt kỷ lục {n} điểm ở", { n: a.score })} <b>{t(NAME[a.game] ?? a.game_name)}</b></>
                  : <><b>{a.name}</b> {t("đã hoàn thành")} <b>{t(NAME[a.game] ?? a.game_name)}</b> · {t("{n} điểm", { n: a.score })}</>}</p>
                <p className="text-xs text-muted-foreground">{ago(a.created_at, t)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Ranking() {
  const t = useT();
  const me = useAuth((s) => s.user);
  const [game, setGame] = useState("all");
  const q = useGet<Rank[]>(`/games/ranking?game=${game}&limit=10`);
  const rows = q.data?.data ?? [];
  return (
    <section className="rounded-card border border-border bg-surface p-4 shadow-raised">
      <h2 className="mb-2 font-bold">🏅 {t("Bảng xếp hạng")}</h2>
      <div className="mb-3 flex flex-wrap gap-1">
        {[["all", t("Tất cả")], ...GAMES.map((g) => [g.id, g.icon] as const)].map(([id, label]) => (
          <button key={id} onClick={() => setGame(id)} aria-pressed={game === id} title={id === "all" ? t("Tất cả") : t(NAME[id] ?? id)}
            className={`rounded-btn px-2.5 py-1 text-sm font-semibold ${game === id ? "bg-primary text-primary-foreground" : "bg-surface-secondary hover:bg-border"}`}>{label}</button>
        ))}
      </div>
      {game !== "all" && <p className="mb-2 text-xs text-muted-foreground">{t(NAME[game] ?? game)}</p>}
      {q.isLoading ? <Spinner /> : rows.length === 0 ? <p className="text-sm text-muted-foreground">{t("Chưa có dữ liệu xếp hạng.")}</p> : (
        <ol className="space-y-1.5">
          {rows.map((r) => (
            <li key={r.user_id} className={`flex items-center gap-2.5 rounded-btn px-2 py-1.5 text-sm ${r.username === me?.username ? "bg-primary-soft ring-1 ring-primary/40" : ""}`}>
              <span className="w-7 text-center font-bold">{r.rank <= 3 ? ["🥇", "🥈", "🥉"][r.rank - 1] : `#${r.rank}`}</span>
              <Avatar user={{ username: r.username, avatar_url: r.avatar_url }} size={28} />
              <span className="min-w-0 flex-1 truncate font-medium">{r.name}<span className="ml-1.5 rounded bg-primary-soft px-1 text-[10px] font-bold text-primary-text">Lv.{r.level}</span></span>
              <b>{r.score}</b>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export default function GamesPage() {
  const t = useT();
  const best = useGet<Record<string, number | null>>("/games/summary");
  return (
    <Protected>
      <Page title={t("Trò chơi")}>
        <p className="text-muted-foreground">{t("Chọn một trò chơi và bấm Bắt đầu.")}</p>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
          <ul className="space-y-3">
            {GAMES.map((g) => {
              const score = best.data?.data[g.id];
              return (
                <li key={g.id} className="flex flex-col gap-4 rounded-card border border-border bg-surface p-4 shadow-sm transition hover:border-primary hover:shadow-md sm:flex-row sm:items-center transition duration-200 hover:-translate-y-0.5 hover:shadow-raised-hover">
                  <span className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-4xl shadow ${g.color}`} aria-hidden="true">{g.icon}</span>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-bold">{t(g.name)}</h2>
                      {g.tags.map((tag) => <span key={tag} className="rounded-full bg-surface-secondary px-2 py-0.5 text-xs font-medium">{tag}</span>)}
                    </div>
                    <p className="text-sm text-muted-foreground">{t(g.desc)}</p>
                    {score != null && <p className="text-xs font-semibold text-accent-text">🏆 {t("Điểm cao nhất")}: {score}</p>}
                  </div>
                  <Link href={`/games/${g.slug}`} className="lift shrink-0 rounded-btn bg-primary px-6 py-3 text-center font-bold text-primary-foreground shadow transition hover:bg-primary-hover">▶ {t("Bắt đầu")}</Link>
                </li>
              );
            })}
          </ul>
          <div className="space-y-4 lg:sticky lg:top-20 lg:self-start"><Ranking /><Activity /></div>
        </div>
      </Page>
    </Protected>
  );
}
