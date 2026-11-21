"use client";

import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { Spinner } from "@/components/ui";
import { useGet } from "@/hooks/api";
import { useT } from "@/lib/i18n";
import { useAuth } from "@/store/auth-store";

interface Row { rank: number; user_id: string; xp: number; level: number; username: string; full_name?: string; avatar_url: string }
const nameOf = (r: Row) => r.full_name?.trim() || r.username;
const TOP = [
  { place: 1, bar: "h-28 bg-accent text-accent-foreground" },
  { place: 2, bar: "h-24 bg-secondary text-secondary-foreground" },
  { place: 3, bar: "h-20 bg-primary text-primary-foreground" },
] as const;

/** This week's podium (top 3) and the next places, with your own row highlighted. */
export function LeaderboardCard() {
  const t = useT();
  const me = useAuth((s) => s.user);
  const q = useGet<Row[]>("/leaderboard?period=weekly&limit=10");
  const rows = q.data?.data ?? [];
  const byPlace = (p: number) => rows.find((r) => r.rank === p);
  const rest = rows.filter((r) => r.rank > 3).slice(0, 5);
  const mine = rows.find((r) => r.username === me?.username);
  return (
    <section className="rounded-card border-2 border-border bg-surface p-4 shadow-raised" aria-label={t("Bảng xếp hạng")}>
      <div className="flex items-start justify-between gap-2">
        <div><h2 className="font-bold">🏆 {t("Bảng xếp hạng")}</h2><p className="text-xs text-muted-foreground">{t("Top học viên tuần này")}</p></div>
        <Link href="/leaderboard" className="text-xs font-bold text-primary-text hover:underline">{t("Xem tất cả")}</Link>
      </div>
      {q.isLoading ? <Spinner /> : rows.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">{t("Chưa có ai trên bảng xếp hạng tuần này.")}</p> : (
        <>
          <div className="mt-4 flex items-end justify-center gap-2">
            {[TOP[1], TOP[0], TOP[2]].map((slot) => {
              const r = byPlace(slot.place);
              return (
                <div key={slot.place} className="flex w-[30%] max-w-24 flex-col items-center">
                  {r ? <>
                    <span className={`rounded-full ${r.username === me?.username ? "ring-2 ring-primary ring-offset-2 ring-offset-surface" : ""}`}><Avatar user={r} size={44} /></span>
                    <p className="mt-1 w-full truncate text-center text-xs font-semibold">{nameOf(r)}</p>
                  </> : <span className="h-[3.75rem]" />}
                  <div className={`mt-1 flex w-full flex-col items-center justify-start rounded-t-btn pt-2 ${slot.bar}`}>
                    <span className="text-2xl font-bold leading-none">{slot.place}</span>
                    <span className="mt-1 text-[11px] font-semibold">{r ? `${r.xp} XP` : "—"}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <ol className="mt-3 space-y-1.5">
            {rest.map((r) => {
              const you = r.username === me?.username;
              return (
                <li key={r.user_id} className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${you ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface"}`}>
                  <span className="w-5 text-center font-bold">{r.rank}</span><Avatar user={r} size={24} />
                  <span className="min-w-0 flex-1 truncate font-medium">{you ? t("Bạn") : nameOf(r)}</span>
                  <span className="text-xs font-semibold">{r.xp} XP</span>
                </li>
              );
            })}
            {!mine && me && <li className="flex items-center gap-2 rounded-full border border-dashed border-border px-3 py-1.5 text-sm text-muted-foreground"><span className="w-5 text-center font-bold">—</span><Avatar user={me} size={24} /><span className="min-w-0 flex-1 truncate">{t("Bạn")} · {t("Chưa có XP tuần này")}</span></li>}
          </ol>
        </>
      )}
    </section>
  );
}
