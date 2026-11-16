"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GameDemo } from "@/components/games/demos";
import { TopicPicker } from "@/components/games/topic-picker";
import { POS } from "@/components/study/utils";
import { WordPicture } from "@/components/study/word-picture";
import { Button, Card, ErrorBox, Spinner } from "@/components/ui";
import { KeyboardToggle, VirtualKeyboard, useVirtualKeyboard, type KeyStatus } from "@/components/virtual-keyboard";
import { useSend } from "@/hooks/api";
import { ApiError } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { sfx, useSound } from "@/lib/sfx";
import { speak } from "@/lib/speech";

interface Hint { length: number; translation_vi: string; emoji: string; pos: string; phonetic: string }
interface Finished { score: number; xp_awarded: number; is_record: boolean }
interface GuessResult { pattern: KeyStatus[]; solved: boolean; failed: boolean; attempts: number; answer: string | null; points: number; lives: number; streak: number; best_streak: number; score: number; finished: boolean; result: Finished | null }
interface Row { word: string; pattern: KeyStatus[] }
interface Past { answer: string; solved: boolean; emoji: string; meaning: string }
type Phase = "setup" | "playing" | "over";
type Status = "typing" | "busy" | "solved" | "failed";
const COLOR: Record<KeyStatus, string> = { correct: "#16a34a", present: "#eab308", absent: "#6b7280" };
const RANK: Record<KeyStatus, number> = { correct: 3, present: 2, absent: 1 };
const msg = (e: unknown) => (e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));

function Tile({ letter, state, animate, delay, small }: { letter: string; state: KeyStatus | "typing" | "empty"; animate?: boolean; delay?: number; small: boolean }) {
  const size = small ? "h-10 w-10 text-xl sm:h-12 sm:w-12" : "h-12 w-12 text-2xl sm:h-14 sm:w-14";
  const base = `${size} flex items-center justify-center rounded-md border-2 font-bold uppercase`;
  if (state === "correct" || state === "present" || state === "absent") {
    if (animate) return <span className={`${base} tile-reveal`} style={{ "--tile-bg": COLOR[state], "--tile-from": "transparent", "--tile-from-border": "#94a3b8", animationDelay: `${(delay ?? 0) * 150}ms` } as React.CSSProperties}>{letter}</span>;
    return <span className={`${base} text-white`} style={{ backgroundColor: COLOR[state], borderColor: COLOR[state] }}>{letter}</span>;
  }
  return <span className={`${base} ${state === "typing" ? "scale-105 border-border" : "border-border"}`}>{letter}</span>;
}

export function WordGuess() {
  const t = useT();
  const [sound, setSound] = useSound();
  const [kb, setKb] = useVirtualKeyboard();
  const [topic, setTopic] = useState("");
  const [lives0, setLives0] = useState(3);
  const [phase, setPhase] = useState<Phase>("setup");
  const [sid, setSid] = useState("");
  const [hints, setHints] = useState<Hint[]>([]);
  const [maxTry, setMaxTry] = useState(6);
  const [index, setIndex] = useState(0);
  const [rows, setRows] = useState<Row[]>([]);
  const [cur, setCur] = useState("");
  const [status, setStatus] = useState<Status>("typing");
  const [answer, setAnswer] = useState<string | null>(null);
  const [lives, setLives] = useState(3);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const [score, setScore] = useState(0);
  const [keys, setKeys] = useState<Record<string, KeyStatus>>({});
  const [past, setPast] = useState<Past[]>([]);
  const [final, setFinal] = useState<Finished | null>(null);
  const [note, setNote] = useState("");
  const [shake, setShake] = useState(false);
  const [points, setPoints] = useState(0);
  const start = useSend<{ session_id: string; lives: number; max_attempts: number; hints: Hint[] }, { topic: string; lives: number }>("POST", "/games/word_guess/start");
  const guessReq = useSend<GuessResult, { session_id: string; index: number; guess: string }>("POST", "/games/word_guess/guess", ["/leaderboard", "/games", "/activity"]);
  const quit = useSend<Finished, { session_id: string }>("POST", "/games/word_guess/finish", ["/leaderboard", "/games", "/activity"]);
  const hint = hints[index];
  const len = hint?.length ?? 5;
  const live = useRef({ status, cur, index, sid, hints, sound, rows });
  live.current = { status, cur, index, sid, hints, sound, rows };
  const bad = (text: string) => { setNote(text); setShake(true); setTimeout(() => setShake(false), 350); };

  function begin() {
    start.mutate({ topic, lives: lives0 }, {
      onSuccess: (r) => {
        setSid(r.data.session_id); setHints(r.data.hints); setMaxTry(r.data.max_attempts); setLives(r.data.lives);
        setIndex(0); setRows([]); setCur(""); setStatus("typing"); setAnswer(null); setStreak(0); setBest(0); setScore(0); setKeys({}); setPast([]); setFinal(null); setNote(""); setPhase("playing");
      },
    });
  }

  const submit = useCallback(async () => {
    const L = live.current, h = L.hints[L.index];
    if (L.status !== "typing" || !h) return;
    if (L.cur.length !== h.length) { bad(t("Cần đủ {n} chữ cái", { n: h.length })); return; }
    setStatus("busy"); setNote("");
    try {
      const r = (await guessReq.mutateAsync({ session_id: L.sid, index: L.index, guess: L.cur })).data;
      setRows((x) => [...x, { word: L.cur, pattern: r.pattern }]); setCur("");
      setKeys((k) => { const n = { ...k }; r.pattern.forEach((p, i) => { const c = L.cur[i] ?? ""; if (c && RANK[p] > (RANK[n[c] as KeyStatus] ?? 0)) n[c] = p; }); return n; });
      setLives(r.lives); setStreak(r.streak); setBest(r.best_streak); setScore(r.score); setPoints(r.points);
      if (r.solved || r.failed) {
        setStatus(r.solved ? "solved" : "failed"); setAnswer(r.answer);
        setPast((p) => [...p, { answer: r.answer ?? "", solved: r.solved, emoji: h.emoji, meaning: h.translation_vi }]);
        if (L.sound) { if (r.solved) { sfx.ok(); speak(r.answer ?? ""); } else sfx.bad(); }
      } else { setStatus("typing"); if (L.sound) sfx.key(); }
      if (r.finished) { setFinal(r.result); setTimeout(() => setPhase("over"), 2200); if (L.sound) setTimeout(r.solved ? sfx.win : sfx.lose, 400); }
    } catch (e) { setStatus("typing"); bad(msg(e)); }
  }, [guessReq, t]); // eslint-disable-line react-hooks/exhaustive-deps

  const next = useCallback(() => {
    setIndex((i) => i + 1); setRows([]); setCur(""); setStatus("typing"); setAnswer(null); setKeys({}); setNote(""); setPoints(0);
  }, []);
  const press = useCallback((k: string) => {
    const L = live.current;
    if (k === "Enter") { if (L.status === "solved" || L.status === "failed") next(); else void submit(); return; }
    if (L.status !== "typing") return;
    const max = L.hints[L.index]?.length ?? 0;
    if (k === "Backspace") setCur((c) => c.slice(0, -1));
    else if (/^[a-z]$/.test(k)) setCur((c) => (c.length < max ? c + k : c));
  }, [next, submit]);
  useEffect(() => {
    if (phase !== "playing") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (k === "Enter" || k === "Backspace" || /^[a-z]$/.test(k)) { e.preventDefault(); press(k); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, press]);

  function finishNow() {
    quit.mutate({ session_id: sid }, { onSuccess: (r) => { setFinal(r.data); setPhase("over"); }, onError: () => setPhase("over") });
  }

  if (phase === "setup") {
    return (
      <div className="space-y-4">
        <Card className="space-y-1 text-sm text-muted-foreground">
          <p>🔤 {t("Đoán Từ là Wordle dựng trên chính vốn từ của bạn: đọc nghĩa, xem số chữ cái, rồi ghép đúng từ tiếng Anh trong sáu lượt.")}</p>
          <p>🔥 {t("Giải liên tiếp để tăng chuỗi và điểm thưởng. Thua một từ thì mất 1 mạng và được xem đáp án.")}</p>
        </Card>
        <GameDemo kind="guess" />
        <h2 className="font-semibold">{t("Chọn chủ đề")}</h2>
        <TopicPicker value={topic} onChange={setTopic} />
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium">{t("Số mạng")}</span>
          {[3, 4, 5].map((n) => <button key={n} onClick={() => setLives0(n)} className={`rounded-btn border-2 px-3 py-1.5 text-sm font-semibold ${lives0 === n ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{"❤️".repeat(n)}</button>)}
          <Button onClick={begin} disabled={start.isPending}>{start.isPending ? <Spinner /> : `▶ ${t("Bắt đầu")}`}</Button>
        </div>
        {start.error && <ErrorBox error={start.error} />}
      </div>
    );
  }

  if (phase === "over") {
    const solved = past.filter((p) => p.solved).length;
    return (
      <Card className="space-y-4 text-center">
        <p className="text-5xl">{lives > 0 ? "🏆" : "💔"}</p>
        <h2 className="text-2xl font-bold">{lives > 0 ? t("Bạn đã đoán hết các từ!") : t("Hết mạng rồi!")}</h2>
        <div className="grid grid-cols-3 gap-3">
          {[[t("Điểm"), final?.score ?? score], [t("Từ đúng"), `${solved}/${past.length}`], [t("Chuỗi dài nhất"), `🔥 ${best}`]].map(([l, v]) => <div key={String(l)} className="rounded-xl bg-surface-secondary p-3"><p className="text-xs text-muted-foreground">{l}</p><p className="text-xl font-bold">{v}</p></div>)}
        </div>
        {final && <p className="text-sm text-muted-foreground">+{final.xp_awarded} XP{final.is_record ? ` · 🏆 ${t("Kỷ lục mới!")}` : ""}</p>}
        {quit.isPending && <Spinner />}
        <ul className="grid gap-2 text-left sm:grid-cols-2">
          {past.map((p, i) => (
            <li key={i} className={`flex items-center gap-3 rounded-xl border-2 p-2 ${p.solved ? "border-success bg-success-soft" : "border-error bg-error-soft"}`}>
              <span className="text-2xl">{p.emoji}</span><span className="min-w-0 flex-1"><b>{p.answer}</b><span className="block truncate text-sm">{p.meaning}</span></span>
              <span>{p.solved ? "✓" : "✗"}</span>
              <button className="rounded-full bg-primary px-2 py-1 text-primary-foreground" onClick={() => speak(p.answer)} aria-label={t("Nghe")}>🔊</button>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap justify-center gap-2"><Button onClick={begin} disabled={start.isPending}>{t("Chơi lại")}</Button><Button variant="ghost" onClick={() => setPhase("setup")}>{t("Chọn chủ đề khác")}</Button></div>
      </Card>
    );
  }

  const small = len >= 7;
  const done = status === "solved" || status === "failed";
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-btn bg-surface-secondary px-3 py-2 text-sm font-semibold">
        <span>{t("Từ {a}/{b}", { a: index + 1, b: hints.length })}</span>
        <span aria-label={t("Số mạng")}>{Array.from({ length: Math.max(lives0, lives) }, (_, i) => <span key={i}>{i < lives ? "❤️" : "🖤"}</span>)}</span>
        <span title={t("Chuỗi")}><span className={streak > 0 ? "animate-flame inline-block" : "inline-block opacity-40"}>🔥</span> {streak}</span>
        <span>⭐ {score}</span>
        <span className="flex items-center gap-1.5"><KeyboardToggle on={kb} onChange={setKb} /><button className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-border bg-surface" onClick={() => setSound(!sound)} aria-pressed={sound} aria-label={t("Âm thanh")}>{sound ? "🔊" : "🔇"}</button></span>
      </div>

      {hint && (
        <Card className="flex flex-wrap items-center justify-center gap-4 text-center">
          <WordPicture word={{ word: answer ?? "", emoji: hint.emoji, image_url: "" }} size={88} />
          <div><p className="text-2xl font-bold text-secondary-text">{hint.translation_vi}</p>
            <p className="text-sm text-muted-foreground">{t(POS[hint.pos] ?? "Khác")} · {t("{n} chữ cái", { n: hint.length })}{done && hint.phonetic ? ` · ${hint.phonetic}` : ""}</p></div>
        </Card>
      )}

      <div className="flex flex-col items-center gap-1.5" aria-label={t("Bảng đoán từ")}>
        {Array.from({ length: maxTry }, (_, r) => {
          const row = rows[r], typing = r === rows.length && !done;
          return (
            <div key={`${index}-${r}`} className={`flex gap-1.5 ${typing && shake ? "animate-shake" : ""}`}>
              {Array.from({ length: len }, (_, i) => row
                ? <Tile key={i} letter={row.word[i] ?? ""} state={row.pattern[i] ?? "absent"} animate={r === rows.length - 1} delay={i} small={small} />
                : <Tile key={i} letter={typing ? cur[i] ?? "" : ""} state={typing && cur[i] ? "typing" : "empty"} small={small} />)}
            </div>
          );
        })}
      </div>

      <p className="min-h-7 text-center text-sm font-semibold" role="status">
        {note && <span className="text-error-text">{note}</span>}
        {status === "solved" && <span className="text-success-text">🎉 {t("Chính xác!")} +{points}</span>}
        {status === "failed" && <span className="text-error-text">{t("Đáp án")}: <b className="text-lg">{answer}</b> {hint?.phonetic}</span>}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {done && !phase.startsWith("o") && past.length < hints.length && lives > 0 && <Button onClick={next}>{t("Từ tiếp theo")} (Enter)</Button>}
        {!done && <Button onClick={() => void submit()} disabled={status === "busy" || cur.length !== len}>{t("Kiểm tra")} (Enter)</Button>}
        <Button variant="ghost" onClick={finishNow} disabled={quit.isPending}>{t("Kết thúc")}</Button>
      </div>
      {kb && <VirtualKeyboard status={keys} onKey={press} />}
      <p className="text-center text-xs text-muted-foreground">{t("Gõ trên bàn phím hoặc bàn phím ảo. Enter để gửi, ⌫ để xóa.")}</p>
    </div>
  );
}
