"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { avatarSrc } from "@/components/avatar";
import { TopicPicker } from "@/components/games/topic-picker";
import { Button, Card, ErrorBox, Spinner } from "@/components/ui";
import { useSend } from "@/hooks/api";
import { sfx, useSound } from "@/lib/sfx";
import { speak, stopSpeaking } from "@/lib/speech";
import { useT } from "@/lib/i18n";
import { shuffle } from "@/lib/utils";
import { useAuth } from "@/store/auth-store";
import type { BridgeScene } from "@/components/games/bridge-scene";

interface Level { word: string; phonetic: string; translation_vi: string; emoji: string; sentence: string; sentence_vi: string }
interface Plank { id: number; word: string; used: boolean; bad: boolean }
interface Finished { score: number; xp_awarded: number; is_record: boolean }
type Phase = "setup" | "loading" | "playing" | "filled" | "success" | "lost" | "won";
const HEARTS = 5, ADVANCE_MS = 3800;

function makePlanks(tokens: string[]): Plank[] {
  let planks = tokens.map((word, id) => ({ id, word, used: false, bad: false }));
  for (let i = 0; i < 6 && tokens.length > 1; i++) { planks = shuffle(planks); if (planks.some((p, k) => p.word !== tokens[k])) break; }
  return planks;
}

export function WordBridge() {
  const t = useT();
  const user = useAuth((s) => s.user);
  const [sound, setSound] = useSound();
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(8);
  const [phase, setPhase] = useState<Phase>("setup");
  const [levels, setLevels] = useState<Level[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [idx, setIdx] = useState(0);
  const [planks, setPlanks] = useState<Plank[]>([]);
  const [slots, setSlots] = useState<(number | null)[]>([]);
  const [hearts, setHearts] = useState(HEARTS);
  const [score, setScore] = useState(0);
  const [sceneReady, setSceneReady] = useState(false);
  const [sceneFailed, setSceneFailed] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<BridgeScene | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stats = useRef({ correct: 0, perfect: 0, completed: 0, mistakes: 0, sentenceMistakes: 0, awarded: new Set<number>() });
  const start = useSend<{ session_id: string; levels: Level[] }, { topic: string; count: number }>("POST", "/games/word_bridge/start");
  const finish = useSend<Finished, { session_id: string; correct: number; perfect: number; completed: number; mistakes: number }>("POST", "/games/word_bridge/finish", ["/leaderboard", "/games", "/activity"]);

  const level = levels[idx];
  const tokens = level ? level.sentence.split(/\s+/) : [];
  const live = useRef({ phase, planks, slots, hearts, idx, tokens, levels, sound });
  live.current = { phase, planks, slots, hearts, idx, tokens, levels, sound };
  const sfxOn = (f: () => void) => { if (live.current.sound) f(); };

  // ---- the 3D scene (loaded on demand: three.js is large)
  useEffect(() => {
    if (phase === "setup" || scene.current || !canvas.current) return;
    let cancelled = false;
    void import("@/components/games/bridge-scene").then(({ BridgeScene: Scene }) => {
      if (cancelled || !canvas.current) return;
      const s = new Scene(canvas.current);
      s.setAvatar(avatarSrc(user?.avatar_url) || null, user?.username.slice(0, 1) ?? "?");
      scene.current = s; setSceneReady(true);
    }).catch(() => setSceneFailed(true)); // no WebGL: the game still works without the picture
    return () => { cancelled = true; };
  }, [phase, user]);
  useEffect(() => () => { scene.current?.dispose(); scene.current = null; if (timer.current) clearTimeout(timer.current); stopSpeaking(); }, []);

  const startLevel = useCallback((i: number, list: Level[]) => {
    const toks = (list[i]?.sentence ?? "").split(/\s+/);
    setIdx(i); setPlanks(makePlanks(toks)); setSlots(toks.map(() => null)); setPhase("playing");
    stats.current.sentenceMistakes = 0; stats.current.awarded = new Set();
    scene.current?.setLevel(toks.length);
  }, []);
  useEffect(() => { if (sceneReady && phase !== "setup" && level) scene.current?.setLevel(tokens.length); }, [sceneReady]); // eslint-disable-line react-hooks/exhaustive-deps

  function begin() {
    start.mutate({ topic, count }, {
      onSuccess: (r) => {
        setLevels(r.data.levels); setSessionId(r.data.session_id); setHearts(HEARTS); setScore(0);
        stats.current = { correct: 0, perfect: 0, completed: 0, mistakes: 0, sentenceMistakes: 0, awarded: new Set() };
        finish.reset(); setPhase("loading"); startLevel(0, r.data.levels);
      },
    });
  }
  const send = (sid = sessionId) => finish.mutate({ session_id: sid, correct: stats.current.correct, perfect: stats.current.perfect, completed: stats.current.completed, mistakes: stats.current.mistakes });

  function pick(p: Plank) {
    const L = live.current;
    if (L.phase !== "playing" || p.used) return;
    const next = L.slots.findIndex((s) => s === null);
    if (next < 0) return;
    if (p.word === L.tokens[next]) { // right word: it goes into the next slot, a plank appears and the bird jumps onto it
      setSlots(L.slots.map((s, k) => (k === next ? p.id : s)));
      setPlanks(L.planks.map((x) => (x.id === p.id ? { ...x, used: true } : x)));
      if (!stats.current.awarded.has(next)) { stats.current.awarded.add(next); stats.current.correct += 1; setScore((s) => s + 10); }
      void scene.current?.place(next, p.word);
      sfxOn(sfx.pop);
      if (next === L.tokens.length - 1) setPhase("filled");
    } else { // wrong word: it is not placed, the plank turns red and shakes, a heart is lost
      stats.current.mistakes += 1; stats.current.sentenceMistakes += 1;
      setPlanks(L.planks.map((x) => (x.id === p.id ? { ...x, bad: true } : x)));
      setTimeout(() => setPlanks((ps) => ps.map((x) => (x.id === p.id ? { ...x, bad: false } : x))), 600);
      void scene.current?.startle();
      sfxOn(sfx.bad);
      const left = L.hearts - 1;
      setHearts(left);
      if (left <= 0) { setPhase("lost"); void scene.current?.fall(); sfxOn(sfx.lose); send(); }
    }
  }
  function giveBack(from: number) { // click a word in a slot: it (and the words after it) go back to the board
    const L = live.current;
    if ((L.phase !== "playing" && L.phase !== "filled") || L.slots[from] == null) return;
    const freed = new Set(L.slots.slice(from).filter((x): x is number => x !== null));
    setSlots(L.slots.map((s, k) => (k >= from ? null : s)));
    setPlanks(L.planks.map((x) => (freed.has(x.id) ? { ...x, used: false } : x)));
    void scene.current?.remove(from);
    setPhase("playing");
  }
  const advance = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    stopSpeaking();
    const L = live.current;
    if (L.idx + 1 < L.levels.length) startLevel(L.idx + 1, L.levels);
    else { setPhase("won"); if (L.sound) sfx.win(); send(); }
  }, [startLevel]); // eslint-disable-line react-hooks/exhaustive-deps
  const check = useCallback(() => {
    const L = live.current;
    if (L.phase !== "filled") return;
    setPhase("success");
    stats.current.completed += 1;
    if (stats.current.sentenceMistakes === 0) { stats.current.perfect += 1; setScore((s) => s + 50); }
    if (L.sound) { sfx.ok(); speak(L.tokens.join(" ")); }
    void scene.current?.complete().then(() => scene.current?.cross());
    timer.current = setTimeout(advance, ADVANCE_MS); // next sentence by itself after ~3.8 s; Enter skips the wait
  }, [advance]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter") return;
      const p = live.current.phase;
      if (p === "filled") { e.preventDefault(); check(); } else if (p === "success") { e.preventDefault(); advance(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [check, advance]);

  // ------------------------------------------------------------------ screens
  if (phase === "setup") {
    return (
      <div className="space-y-4">
        <Card className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
          <p>🎯 {t("Xếp các từ thành câu đúng theo nghĩa tiếng Việt. Mỗi từ đúng dựng một nhịp cầu và avatar của bạn nhảy lên đó.")}</p>
          <p>❤️ {t("Chọn sai từ: mất 1 trong 5 tim. Hết tim: chú chim rơi xuống sông.")} · ⭐ {t("Mỗi từ đúng 10 điểm, câu không sai lần nào được thêm 50.")}</p>
        </Card>
        <h2 className="font-semibold">{t("Chọn chủ đề")}</h2>
        <TopicPicker value={topic} onChange={setTopic} />
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm font-medium">{t("Số câu")}
            <select className="ml-2 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" value={count} onChange={(e) => setCount(Number(e.target.value))}>{[5, 8, 10, 12, 15].map((n) => <option key={n}>{n}</option>)}</select></label>
          <Button onClick={begin} disabled={start.isPending}>{start.isPending ? <Spinner /> : `▶ ${t("Bắt đầu")}`}</Button>
        </div>
        {start.error && <ErrorBox error={start.error} />}
      </div>
    );
  }

  const done = slots.filter((s) => s !== null).length;
  const over = phase === "lost" || phase === "won";
  const wood = "relative rounded-lg border-b-4 border-[#7c4a1d] bg-[repeating-linear-gradient(90deg,#c98a4b,#c98a4b_14px,#b87a3f_14px,#b87a3f_16px)] px-4 py-2.5 text-lg font-bold text-[#3b200b] shadow transition active:translate-y-0.5 disabled:opacity-0";
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold dark:bg-slate-800">
        <span>{t("Màn {a}/{b}", { a: Math.min(idx + 1, levels.length), b: levels.length })}</span>
        <span aria-label={t("Số tim còn lại")}>{Array.from({ length: HEARTS }, (_, i) => <span key={i}>{i < hearts ? "❤️" : "🤍"}</span>)}</span>
        <span>⭐ {score}</span>
        <button className="rounded-lg border border-slate-300 px-2 py-0.5 dark:border-slate-600" onClick={() => setSound(!sound)} aria-pressed={sound} aria-label={t("Âm thanh")}>{sound ? "🔊" : "🔇"}</button>
      </div>

      {level && (
        <Card className="space-y-3 text-center">
          <div className="flex flex-wrap items-center justify-center gap-3">
            <span className="text-4xl">{level.emoji}</span>
            <div className="text-left"><p className="text-2xl font-bold">{level.word} <span className="text-base font-normal text-slate-500">{level.phonetic}</span></p><p className="text-slate-600 dark:text-slate-300">{level.translation_vi}</p></div>
            <button className="rounded-full bg-indigo-600 px-3 py-2 text-white hover:bg-indigo-700" onClick={() => speak(level.word)} aria-label={t("Nghe")}>🔊</button>
          </div>
          <p className="text-lg font-medium italic text-indigo-700 dark:text-indigo-300">“{level.sentence_vi}”</p>
          <ol className="flex flex-wrap justify-center gap-2" aria-label={t("Các ô trống")}>
            {tokens.map((w, i) => {
              const id = slots[i];
              const filled = id !== null && id !== undefined;
              const ok = phase === "success" || phase === "won";
              return (
                <li key={i}>
                  <button disabled={!filled} onClick={() => giveBack(i)} aria-label={filled ? w : t("Ô trống {n}", { n: i + 1 })}
                    className={`min-h-11 min-w-16 rounded-lg border-2 px-3 py-1.5 text-lg font-semibold transition ${filled ? (ok ? "border-green-600 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100" : "border-indigo-500 bg-indigo-50 dark:bg-indigo-950") : i === done ? "animate-pulse border-dashed border-indigo-400" : "border-dashed border-slate-300 dark:border-slate-600"}`}>
                    {filled ? w : ""}
                  </button>
                </li>
              );
            })}
          </ol>
        </Card>
      )}

      <div className="relative h-60 overflow-hidden rounded-2xl bg-gradient-to-b from-sky-400 to-sky-100 sm:h-72">
        <canvas ref={canvas} className="absolute inset-0 h-full w-full" aria-label={t("Cầu và chú chim")} />
        {sceneFailed && (
          <div className="absolute inset-x-4 bottom-4 flex items-end justify-between gap-1" aria-hidden="true">
            <span className="text-3xl" style={{ marginLeft: `${(done / Math.max(1, tokens.length)) * 80}%`, transition: "margin .4s" }}>🐦</span>
          </div>
        )}
        {phase === "success" && level && <p className="absolute inset-x-3 top-3 rounded-xl bg-green-600/95 px-3 py-2 text-center text-lg font-bold text-white shadow">✓ {level.sentence}</p>}
        {phase === "lost" && level && <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/50 p-4 text-center text-white"><p className="text-xl font-bold">💧 {t("Chim rơi xuống sông!")}</p><p>{t("Đáp án đúng")}:</p><p className="text-lg font-semibold text-green-300">{level.sentence}</p></div>}
        {phase === "won" && <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/45 p-4 text-center text-white"><p className="text-4xl">🏆</p><p className="text-2xl font-bold">{t("Bạn đã qua hết các màn!")}</p></div>}
      </div>

      {over ? (
        <Card className="space-y-3 text-center">
          <p className="text-xl font-bold">{phase === "won" ? t("🎉 Chiến thắng!") : t("Thử lại nhé!")}</p>
          <p>{t("Điểm")}: <b>{score}</b> · {t("{n} câu hoàn thành", { n: stats.current.completed })} · {t("Không sai: {n}", { n: stats.current.perfect })}</p>
          {finish.isPending && <Spinner />}
          {finish.data && <p className="text-sm text-slate-600 dark:text-slate-300">+{finish.data.data.xp_awarded} XP{finish.data.data.is_record ? ` · 🏆 ${t("Kỷ lục mới!")}` : ""}</p>}
          {finish.error && <ErrorBox error={finish.error} />}
          <div className="flex flex-wrap justify-center gap-2"><Button onClick={begin} disabled={start.isPending}>{t("Chơi lại")}</Button><Button variant="ghost" onClick={() => { scene.current?.dispose(); scene.current = null; setSceneReady(false); setPhase("setup"); }}>{t("Chọn chủ đề khác")}</Button></div>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap justify-center gap-2 rounded-2xl bg-[#6b4423]/10 p-3" aria-label={t("Các ván gỗ")}>
            {planks.map((p) => <button key={p.id} disabled={p.used || phase !== "playing"} onClick={() => pick(p)} className={`${wood} ${p.bad ? "animate-shake !border-red-800 !bg-red-400 !bg-none !text-white" : ""}`}>{p.word}</button>)}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button variant="ghost" onClick={() => giveBack(0)} disabled={done === 0 || phase === "success"}>{t("Xóa hết")}</Button>
            <Button onClick={check} disabled={phase !== "filled"}>{t("Kiểm tra")}</Button>
            <span className="text-xs text-slate-500">{phase === "success" ? t("Tự chuyển câu sau vài giây. Nhấn Enter để sang ngay.") : t("Điền đủ ô rồi nhấn Kiểm tra hoặc Enter.")}</span>
          </div>
        </>
      )}
      {phase === "success" && <div className="text-center"><Button onClick={advance}>{t("Câu tiếp theo")} (Enter)</Button></div>}
    </div>
  );
}
