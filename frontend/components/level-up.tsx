"use client";

import { useEffect, useMemo, useState } from "react";
import { LevelAvatar } from "@/components/avatar";
import { Button } from "@/components/ui";
import { useGet } from "@/hooks/api";
import { sfx } from "@/lib/sfx";
import { useT } from "@/lib/i18n";
import { useAuth } from "@/store/auth-store";

interface Xp { level: number; total_xp: number; xp_into_level: number; xp_for_next: number }
interface Heat { current_streak: number; longest_streak: number }
interface Seen { level: number; streak: number; day: string }
interface Celebration { level: number; leveledUp: boolean; streak: number; xp: Xp }

const localDay = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const COLORS = ["#f43f5e", "#f59e0b", "#10b981", "#3b82f6", "#a855f7", "#eab308"];

function Confetti() {
  const pieces = useMemo(() => Array.from({ length: 40 }, (_, i) => ({ left: Math.random() * 100, delay: Math.random() * 0.8, color: COLORS[i % COLORS.length], w: 6 + Math.random() * 6 })), []);
  return <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">{pieces.map((p, i) => <span key={i} className="confetti-piece absolute top-0 rounded-sm" style={{ left: `${p.left}%`, width: p.w, height: p.w * 1.6, background: p.color, animationDelay: `${p.delay}s` }} />)}</div>;
}

/** Watches the player's level and daily streak and celebrates when the level goes up (or the streak grows). */
export function GamificationWatcher() {
  const t = useT();
  const user = useAuth((s) => s.user);
  const student = user !== null && user.role !== "admin";
  const tz = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC";
  const xp = useGet<Xp>(student ? "/leaderboard/me" : null);
  const heat = useGet<Heat>(student ? `/activity/heatmap?days=7&tz=${encodeURIComponent(tz)}` : null);
  const [show, setShow] = useState<Celebration | null>(null);

  useEffect(() => {
    if (!user || !student || !xp.data || !heat.data) return;
    const level = xp.data.data.level, streak = heat.data.data.current_streak, key = `gami:${user.id}`, today = localDay();
    let seen: Seen | null = null;
    try { seen = JSON.parse(localStorage.getItem(key) ?? "null") as Seen | null; } catch { /* ignore */ }
    const save = (s: Seen) => { try { localStorage.setItem(key, JSON.stringify(s)); } catch { /* ignore */ } };
    if (!seen) { save({ level, streak, day: today }); return; } // first visit on this device: nothing to celebrate yet
    const leveledUp = level > seen.level;
    const streakGrew = streak >= 2 && streak > seen.streak && seen.day !== today;
    save({ level, streak, day: streakGrew ? today : seen.day });
    if (leveledUp || streakGrew) { setShow({ level, leveledUp, streak, xp: xp.data.data }); sfx.win(); }
  }, [user, student, xp.data, heat.data]);

  useEffect(() => {
    if (!show) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" || e.key === "Enter") setShow(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [show]);

  if (!show || !user) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/65 p-4" onClick={() => setShow(null)}>
      <div role="dialog" aria-modal="true" aria-label={show.leveledUp ? t("Chúc mừng lên cấp!") : t("Giữ vững chuỗi ngày học!")} onClick={(e) => e.stopPropagation()}
        className="animate-modal relative w-full max-w-sm overflow-hidden rounded-3xl bg-white p-6 text-center text-slate-900 shadow-2xl dark:bg-slate-900 dark:text-slate-100">
        <Confetti />
        <div className="relative space-y-3">
          <p className="text-sm font-bold uppercase tracking-widest text-amber-500">{show.leveledUp ? t("Chúc mừng!") : t("Tuyệt vời!")}</p>
          {show.leveledUp ? (
            <>
              <div className="flex justify-center py-2"><LevelAvatar user={user} level={show.level} size={104} /></div>
              <h2 className="text-2xl font-extrabold">{t("Bạn đã lên cấp {n}!", { n: show.level })}</h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">{t("Tổng XP: {a} · còn {b} XP nữa để lên cấp {n}.", { a: show.xp.total_xp, b: show.xp.xp_for_next - show.xp.xp_into_level, n: show.level + 1 })}</p>
            </>
          ) : <h2 className="text-2xl font-extrabold">{t("Giữ vững chuỗi ngày học!")}</h2>}
          {show.streak >= 2 && (
            <div className="rounded-2xl bg-orange-50 p-3 dark:bg-orange-950/40">
              <p className="text-4xl"><span className="animate-flame inline-block">🔥</span></p>
              <p className="font-bold text-orange-700 dark:text-orange-300">{t("Chuỗi {n} ngày liên tiếp", { n: show.streak })}</p>
              <p className="text-xs text-slate-600 dark:text-slate-300">{t("Học mỗi ngày một chút để không đứt chuỗi nhé.")}</p>
            </div>
          )}
          <Button onClick={() => setShow(null)} className="w-full">{t("Tiếp tục")}</Button>
        </div>
      </div>
    </div>
  );
}
