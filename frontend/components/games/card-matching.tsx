"use client";

import { useEffect, useRef, useState } from "react";
import { GameDemo } from "@/components/games/demos";
import { Button, ErrorBox, Tabs } from "@/components/ui";
import { useGet, useSend } from "@/hooks/api";
import { useT } from "@/lib/i18n";
import { shuffle } from "@/lib/utils";
import type { Pair } from "@/types";

type Mode = "classic" | "memory";
interface Best { score: number; flips: number | null; duration: number | null }
interface Result { score: number; duration: number; flips: number; xp_awarded: number; is_record: boolean }
interface MemCard { uid: string; pair_id: string; text: string }

const INVALIDATE = ["/leaderboard", "/games", "/activity"];

export function CardMatching() {
  const t = useT();
  const [mode, setMode] = useState<Mode>("memory");
  const best = useGet<Record<Mode, Best | null>>("/games/card_matching/best");
  const start = useSend<{ session_id: string; pairs: Pair[] }>("POST", "/games/card_matching/start");
  const submit = useSend<Result, { session_id: string; correct: number; wrong: number; mode: Mode; flips: number }>("POST", "/games/card_matching/submit", INVALIDATE);

  const [session, setSession] = useState<string | null>(null);
  const [pairs, setPairs] = useState<Pair[]>([]);
  // classic
  const [en, setEn] = useState<Pair[]>([]);
  const [vi, setVi] = useState<Pair[]>([]);
  const [selEn, setSelEn] = useState<string | null>(null);
  const [selVi, setSelVi] = useState<string | null>(null);
  const [wrongPick, setWrongPick] = useState<string | null>(null);
  // memory
  const [cards, setCards] = useState<MemCard[]>([]);
  const [open, setOpen] = useState<string[]>([]);
  const [preview, setPreview] = useState(0);
  const lock = useRef(false);
  // shared
  const [matched, setMatched] = useState<string[]>([]);
  const [wrong, setWrong] = useState(0);
  const [turns, setTurns] = useState(0);

  useEffect(() => { // memory preview countdown: cards start face-up so the player can memorise them
    if (preview <= 0) return;
    const id = setTimeout(() => setPreview((p) => p - 1), 1000);
    return () => clearTimeout(id);
  }, [preview]);

  function begin() {
    start.mutate(undefined, {
      onSuccess: (r) => {
        const ps = r.data.pairs;
        setSession(r.data.session_id); setPairs(ps); setMatched([]); setWrong(0); setTurns(0); setOpen([]);
        setSelEn(null); setSelVi(null); lock.current = false; submit.reset();
        if (mode === "classic") { setEn(shuffle(ps)); setVi(shuffle(ps)); }
        else {
          setCards(shuffle(ps.flatMap((p) => [{ uid: `${p.pair_id}-en`, pair_id: p.pair_id, text: p.en }, { uid: `${p.pair_id}-vi`, pair_id: p.pair_id, text: p.vi }])));
          setPreview(4);
        }
      },
    });
  }

  function finishIf(m: string[], flips: number, wrongCount: number) {
    if (session && m.length === pairs.length) submit.mutate({ session_id: session, correct: m.length, wrong: wrongCount, mode, flips });
  }

  function pickClassic(side: "en" | "vi", id: string) {
    const e = side === "en" ? id : selEn;
    const v = side === "vi" ? id : selVi;
    if (side === "en") setSelEn(id); else setSelVi(id);
    if (!e || !v) return;
    if (e === v) { const m = [...matched, e]; setMatched(m); finishIf(m, 0, wrong); }
    else { setWrong((w) => w + 1); setWrongPick(`${e}|${v}`); setTimeout(() => setWrongPick(null), 400); }
    setSelEn(null); setSelVi(null);
  }

  function pickMemory(c: MemCard) {
    if (lock.current || preview > 0 || open.includes(c.uid) || matched.includes(c.pair_id)) return;
    const next = [...open, c.uid];
    setOpen(next);
    if (next.length < 2) return;
    const nt = turns + 1;
    setTurns(nt);
    const [a, b] = next.map((uid) => cards.find((x) => x.uid === uid));
    if (a && b && a.pair_id === b.pair_id) {
      const m = [...matched, a.pair_id];
      setMatched(m); setOpen([]); finishIf(m, nt, 0);
    } else {
      lock.current = true;
      setTimeout(() => { setOpen([]); lock.current = false; }, 900);
    }
  }

  const result = submit.data?.data;
  const playing = session !== null && !result;
  const b = best.data?.data[mode];

  const classicCell = (p: Pair, side: "en" | "vi", selected: string | null) => {
    const done = matched.includes(p.pair_id);
    const bad = selected === p.pair_id && wrongPick !== null;
    return (
      <button key={p.pair_id} disabled={done} onClick={() => pickClassic(side, p.pair_id)}
        className={`rounded-lg border p-3 text-sm transition ${done ? "border-green-500 bg-green-50 text-green-800 opacity-60 dark:bg-green-950 dark:text-green-200"
          : bad ? "animate-shake border-red-500 bg-red-50 dark:bg-red-950" : selected === p.pair_id ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950" : "border-slate-300 hover:border-indigo-400 dark:border-slate-700"}`}>
        {side === "en" ? p.en : p.vi}
      </button>
    );
  };

  return (
    <div className="space-y-4">
      <Tabs value={mode} onChange={(m) => { if (!playing) { setMode(m); setSession(null); submit.reset(); } }}
        options={[["memory", t("Lật thẻ ghi nhớ")], ["classic", t("Ghép cặp")]] as const} />
      <p className="text-sm text-slate-500 dark:text-slate-400">
        {mode === "memory" ? t("Các thẻ được lật 4 giây để bạn ghi nhớ, sau đó úp xuống. Lật 2 thẻ để tìm cặp từ - nghĩa. Ít lượt lật hơn = điểm cao hơn.")
          : t("Chọn một từ tiếng Anh và nghĩa tiếng Việt tương ứng.")}
      </p>
      <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
        🏆 {b ? t("Điểm cao nhất: {score} · {flips} lượt lật", { score: b.score, flips: b.flips ?? "–" }) : t("Chưa có điểm cao nhất. Hãy chơi ngay!")}
      </p>

      {!playing && <GameDemo kind={mode} />}
      {!playing && (
        <div className="space-y-2">
          {result && (
            <div className="animate-pop rounded-xl border border-green-500 p-4">
              <p className="text-lg font-semibold">{result.is_record ? t("🎉 Kỷ lục mới!") : t("Hoàn thành!")}</p>
              <p>{t("Điểm: {score} · {flips} lượt lật · {sec}s · +{xp} XP", { score: result.score, flips: result.flips, sec: result.duration, xp: result.xp_awarded })}</p>
            </div>
          )}
          <Button onClick={begin} disabled={start.isPending}>{result ? t("Chơi lại") : t("Bắt đầu")}</Button>
        </div>
      )}

      {playing && mode === "classic" && (
        <>
          <p className="text-sm text-slate-500">{t("Đã ghép {n}/{total} · Sai {wrong}", { n: matched.length, total: en.length, wrong })}</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">{en.map((p) => classicCell(p, "en", selEn))}</div>
            <div className="grid gap-2">{vi.map((p) => classicCell(p, "vi", selVi))}</div>
          </div>
        </>
      )}

      {playing && mode === "memory" && (
        <>
          <p className="text-sm text-slate-500">
            {preview > 0 ? t("Ghi nhớ nhanh! Úp thẻ sau {n}s", { n: preview }) : t("Cặp đã tìm: {n}/{total} · Lượt lật: {turns}", { n: matched.length, total: pairs.length, turns })}
          </p>
          <div className="grid grid-cols-4 gap-2 sm:gap-3">
            {cards.map((c) => {
              const faceUp = preview > 0 || open.includes(c.uid) || matched.includes(c.pair_id);
              const done = matched.includes(c.pair_id);
              return (
                <button key={c.uid} onClick={() => pickMemory(c)} aria-label={faceUp ? c.text : "?"} className="flip-scene h-20 sm:h-24">
                  <div className={`flip-inner h-full w-full ${faceUp ? "is-flipped" : ""}`}>
                    <div className="flip-face flex items-center justify-center rounded-lg bg-indigo-600 text-2xl font-bold text-white hover:bg-indigo-500">?</div>
                    <div className={`flip-face flip-back flex items-center justify-center rounded-lg border-2 p-1 text-center text-xs font-medium sm:text-sm ${done ? "animate-pop border-green-500 bg-green-50 text-green-900 dark:bg-green-950 dark:text-green-200" : "border-indigo-300 bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100"}`}>
                      {c.text}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
      {(start.error || submit.error) && <ErrorBox error={start.error ?? submit.error} />}
    </div>
  );
}
