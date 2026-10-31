"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TopicPicker } from "@/components/games/topic-picker";
import { Button, Card, ErrorBox, Spinner } from "@/components/ui";
import { useSend } from "@/hooks/api";
import { sfx, useSound } from "@/lib/sfx";
import { speak, stopSpeaking } from "@/lib/speech";
import { useT } from "@/lib/i18n";
import { shuffle } from "@/lib/utils";

interface RWord { id: string; word: string; phonetic: string; translation_vi: string; emoji: string }
interface Drop { w: RWord; x: number; y: number; typed: number; state: "fall" | "missed"; width: number; hue: number; missedAt: number }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; hue: number; size: number }
interface Pop { x: number; y: number; text: string; life: number; color: string }
interface Learned { w: RWord; ok: boolean }
interface Finished { score: number; xp_awarded: number; is_record: boolean }
type Phase = "setup" | "loading" | "playing" | "paused" | "result";
interface Hud { done: number; total: number; score: number; lives: number; combo: number }

const GROUND = 56, CARD_H = 74, BOX = 24;
const freshGame = () => ({
  drops: [] as Drop[], queue: [] as RWord[], particles: [] as Particle[], pops: [] as Pop[], learned: [] as Learned[],
  rain: Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), v: 0.5 + Math.random() * 0.6 })),
  stars: Array.from({ length: 50 }, () => ({ x: Math.random(), y: Math.random() * 0.6, p: Math.random() * 6 })),
  ripples: [] as { x: number; r: number; life: number }[], locked: null as Drop | null,
  spawnT: 99, elapsed: 0, total: 0, processed: 0, completed: 0, missed: 0, wrongKeys: 0, correctKeys: 0, strikes: 0, combo: 0, maxCombo: 0,
  score: 0, lives: 4, mood: "idle" as "idle" | "happy" | "oops", moodT: 0, flash: 0, shake: 0, over: false, endAt: 0,
});

export function VocabRain() {
  const t = useT();
  const [sound, setSound] = useSound();
  const [topic, setTopic] = useState("");
  const [topicLabel, setTopicLabel] = useState("");
  const [lives, setLives] = useState(4);
  const [phase, setPhase] = useState<Phase>("setup");
  const [hud, setHud] = useState<Hud>({ done: 0, total: 20, score: 0, lives: 4, combo: 0 });
  const [target, setTarget] = useState<RWord | null>(null);
  const [outcome, setOutcome] = useState<{ won: boolean; accuracy: number; seconds: number } | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const size = useRef({ w: 800, h: 480 });
  const g = useRef(freshGame());
  const live = useRef({ phase, sound });
  live.current = { phase, sound };
  const start = useSend<{ session_id: string; words: RWord[] }, { topic: string }>("POST", "/games/vocab_rain/start");
  const finish = useSend<Finished, { session_id: string; correct: number; missed: number; mistakes: number; score: number }>("POST", "/games/vocab_rain/finish", ["/leaderboard", "/games", "/activity"]);
  const sessionRef = useRef("");

  const syncHud = useCallback(() => {
    const s = g.current;
    setHud({ done: s.processed, total: s.total, score: s.score, lives: s.lives, combo: s.combo });
    const lowest = s.locked ?? s.drops.filter((d) => d.state === "fall").sort((a, b) => b.y - a.y)[0] ?? null;
    setTarget(lowest ? lowest.w : null);
  }, []);
  const say = (fn: () => void) => { if (live.current.sound) fn(); };

  function begin() {
    start.mutate({ topic }, {
      onSuccess: (r) => {
        const s = freshGame();
        s.queue = shuffle(r.data.words); s.total = r.data.words.length; s.lives = lives;
        g.current = s; sessionRef.current = r.data.session_id;
        finish.reset(); setOutcome(null); setPhase("playing"); syncHud();
        setTimeout(() => input.current?.focus(), 50);
      },
    });
  }

  // ---------------------------------------------------------------- game rules
  const end = useCallback((won: boolean) => {
    const s = g.current;
    if (s.over) return;
    s.over = true; s.endAt = performance.now();
    say(won ? sfx.win : sfx.lose);
    const keys = s.correctKeys + s.wrongKeys;
    setOutcome({ won, accuracy: keys ? Math.round((s.correctKeys / keys) * 100) : 0, seconds: Math.round(s.elapsed) });
    setTimeout(() => setPhase("result"), 700);
    finish.mutate({ session_id: sessionRef.current, correct: s.completed, missed: s.missed, mistakes: s.wrongKeys, score: s.score });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const settle = useCallback(() => { // finished once every word has been completed or missed
    const s = g.current;
    if (s.processed >= s.total && !s.over) end(true);
    syncHud();
  }, [end, syncHud]);
  const loseLife = useCallback(() => {
    const s = g.current;
    s.lives -= 1; s.flash = 0.35; s.shake = 0.3;
    if (s.lives <= 0) end(false);
  }, [end]);
  const wrongKey = useCallback(() => {
    const s = g.current;
    s.score = Math.max(0, s.score - 5); s.combo = 0; s.wrongKeys += 1; s.strikes += 1; s.mood = "oops"; s.moodT = 0.6; s.flash = 0.2;
    say(sfx.bad);
    if (s.strikes >= 3) { s.strikes = 0; loseLife(); } // small slips cost points, every third one costs a life
    syncHud();
  }, [loseLife, syncHud]); // eslint-disable-line react-hooks/exhaustive-deps
  const complete = useCallback((d: Drop) => {
    const s = g.current;
    s.drops = s.drops.filter((x) => x !== d); s.locked = null;
    s.completed += 1; s.processed += 1; s.combo += 1; s.maxCombo = Math.max(s.maxCombo, s.combo); s.strikes = 0;
    const pts = 10 + Math.min(s.combo - 1, 5) * 2;
    s.score += pts; s.mood = "happy"; s.moodT = 0.9;
    s.learned.push({ w: d.w, ok: true });
    for (let i = 0; i < 26; i++) { const a = Math.random() * Math.PI * 2, v = 60 + Math.random() * 160; s.particles.push({ x: d.x, y: d.y + 30, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, life: 0, max: 0.7 + Math.random() * 0.5, hue: d.hue + Math.random() * 40, size: 2 + Math.random() * 3 }); }
    s.pops.push({ x: d.x, y: d.y, text: `+${pts}`, life: 0, color: "#fde047" });
    if (s.combo >= 3) s.pops.push({ x: d.x, y: d.y - 26, text: `COMBO x${s.combo}`, life: 0, color: "#f9a8d4" });
    say(sfx.ok);
    if (live.current.sound) speak(d.w.word);
    settle();
  }, [settle]); // eslint-disable-line react-hooks/exhaustive-deps
  const miss = useCallback((d: Drop) => {
    const s = g.current;
    d.state = "missed"; d.missedAt = performance.now();
    if (s.locked === d) s.locked = null;
    s.missed += 1; s.processed += 1; s.combo = 0; s.mood = "oops"; s.moodT = 1;
    s.learned.push({ w: d.w, ok: false });
    s.ripples.push({ x: d.x, r: 4, life: 0 });
    say(sfx.lose);
    loseLife();
    settle();
  }, [loseLife, settle]); // eslint-disable-line react-hooks/exhaustive-deps

  const typeChar = useCallback((raw: string) => {
    const s = g.current;
    if (live.current.phase !== "playing" || s.over) return;
    const ch = raw.toLowerCase();
    if (!/^[a-z' -]$/.test(ch)) return;
    let d = s.locked;
    if (!d) d = s.drops.filter((x) => x.state === "fall" && (x.w.word[0] ?? "").toLowerCase() === ch).sort((a, b) => b.y - a.y)[0] ?? null; // lowest matching word
    if (!d) { wrongKey(); return; }
    if (ch !== (d.w.word[d.typed] ?? "").toLowerCase()) { wrongKey(); return; }
    d.typed += 1; s.locked = d; s.correctKeys += 1;
    say(sfx.key);
    if (d.typed >= d.w.word.length) complete(d); else syncHud();
  }, [complete, wrongKey, syncHud]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------- loop + drawing
  useEffect(() => {
    if (phase !== "playing" && phase !== "paused" && phase !== "result") return;
    const cv = canvas.current, host = box.current;
    if (!cv || !host) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2), w = host.clientWidth, h = host.clientHeight;
      cv.width = w * dpr; cv.height = h * dpr; size.current = { w, h };
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    let raf = 0, last = performance.now();

    const roundRect = (x: number, y: number, w: number, h: number, r: number) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min((now - last) / 1000, 0.05); last = now;
      const { w, h } = size.current, s = g.current, ground = h - GROUND;
      const running = live.current.phase === "playing" && !s.over;
      if (running) {
        s.elapsed += dt; s.spawnT += dt; s.moodT -= dt; s.flash = Math.max(0, s.flash - dt); s.shake = Math.max(0, s.shake - dt);
        const active = s.drops.filter((d) => d.state === "fall").length;
        const maxActive = s.processed < 6 ? 1 : s.processed < 14 ? 2 : 3;
        if (s.queue.length > 0 && active < maxActive && s.spawnT >= Math.max(1.3, 2.7 - s.processed * 0.07)) {
          const word = s.queue.shift() as RWord;
          const width = Math.max(140, word.word.length * (BOX + 4) + 26);
          let x = w / 2;
          for (let k = 0; k < 8; k++) { x = Math.max(width / 2 + 10, Math.min(w - width / 2 - 10, 120 + width / 2 + Math.random() * (w - 160 - width))); if (!s.drops.some((d) => Math.abs(d.x - x) < (d.width + width) / 2 + 8 && d.y < CARD_H + 30)) break; }
          s.drops.push({ w: word, x, y: -CARD_H, typed: 0, state: "fall", width, hue: Math.floor(Math.random() * 360), missedAt: 0 });
          s.spawnT = 0; syncHud();
        }
        const speed = Math.min(110, 36 + 2.4 * s.processed);
        for (const d of [...s.drops]) {
          if (d.state === "fall") { d.y += speed * dt; if (d.y + CARD_H >= ground) miss(d); }
          else if (now - d.missedAt > 2200) s.drops = s.drops.filter((x) => x !== d); // the correct answer stays visible for 2 s
        }
        for (const p of s.particles) { p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 260 * dt; }
        s.particles = s.particles.filter((p) => p.life < p.max);
        for (const p of s.pops) { p.life += dt; p.y -= 30 * dt; }
        s.pops = s.pops.filter((p) => p.life < 1.1);
        for (const r of s.ripples) { r.life += dt; r.r += 40 * dt; }
        s.ripples = s.ripples.filter((r) => r.life < 1);
        for (const r of s.rain) { r.y += r.v * dt * 0.9; r.x -= r.v * dt * 0.12; if (r.y > 1) { r.y = 0; r.x = Math.random() * 1.2; } if (r.x < 0) r.x += 1; }
      }
      ctx.save();
      if (s.shake > 0) ctx.translate((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8);
      // night sky
      const sky = ctx.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, "#050d2b"); sky.addColorStop(1, "#143a7b");
      ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
      for (const st of s.stars) { ctx.globalAlpha = 0.4 + 0.5 * Math.abs(Math.sin(now / 900 + st.p)); ctx.fillStyle = "#fff"; ctx.fillRect(st.x * w, st.y * h, 2, 2); }
      ctx.globalAlpha = 1; ctx.fillStyle = "#fef9c3"; ctx.beginPath(); ctx.arc(w - 80, 70, 26, 0, 7); ctx.fill(); ctx.fillStyle = "#143a7b"; ctx.beginPath(); ctx.arc(w - 70, 64, 24, 0, 7); ctx.fill();
      // light rain
      ctx.strokeStyle = "rgba(186,230,253,0.35)"; ctx.lineWidth = 1; ctx.beginPath();
      for (const r of s.rain) { const x = r.x * w, y = r.y * h; ctx.moveTo(x, y); ctx.lineTo(x - 3, y + 11); }
      ctx.stroke();
      // water / ground
      ctx.fillStyle = "#0b2a5b"; ctx.beginPath(); ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += 12) ctx.lineTo(x, ground + Math.sin(x / 38 + now / 500) * 3);
      ctx.lineTo(w, h); ctx.fill();
      ctx.strokeStyle = "rgba(125,211,252,0.6)"; ctx.lineWidth = 2; ctx.beginPath();
      for (let x = 0; x <= w; x += 12) { const y = ground + Math.sin(x / 38 + now / 500) * 3; if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
      ctx.stroke();
      for (const r of s.ripples) { ctx.strokeStyle = `rgba(186,230,253,${1 - r.life})`; ctx.beginPath(); ctx.ellipse(r.x, ground + 6, r.r, r.r / 3, 0, 0, 7); ctx.stroke(); }
      // the little character (bottom left) with an umbrella
      const bounce = s.mood === "happy" && s.moodT > 0 ? Math.abs(Math.sin(now / 90)) * 10 : 0, cx = 60, cy = ground - 14 - bounce;
      ctx.fillStyle = "#ef4444"; ctx.beginPath(); ctx.arc(cx, cy - 30, 38, Math.PI, 0); ctx.fill();
      ctx.strokeStyle = "#7f1d1d"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx, cy - 30); ctx.lineTo(cx, cy - 12); ctx.stroke();
      ctx.fillStyle = "#fcd34d"; ctx.beginPath(); ctx.arc(cx, cy, 25, 0, 7); ctx.fill();
      const look = s.locked ? Math.max(-3, Math.min(3, (s.locked.x - cx) / 120)) : 0;
      for (const ex of [-9, 9]) { ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(cx + ex, cy - 4, 6, 0, 7); ctx.fill(); ctx.fillStyle = "#111827"; ctx.beginPath(); ctx.arc(cx + ex + look, cy - 3, 3, 0, 7); ctx.fill(); }
      ctx.fillStyle = "rgba(244,114,182,0.7)"; for (const ex of [-16, 16]) { ctx.beginPath(); ctx.arc(cx + ex, cy + 6, 4, 0, 7); ctx.fill(); }
      ctx.strokeStyle = "#7c2d12"; ctx.lineWidth = 2; ctx.beginPath();
      if (s.mood === "oops" && s.moodT > 0) ctx.arc(cx, cy + 16, 6, Math.PI * 1.1, Math.PI * 1.9); else ctx.arc(cx, cy + 6, 8, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
      // falling words: the Vietnamese meaning on top, one square per letter underneath
      for (const d of s.drops) {
        const x0 = d.x - d.width / 2;
        if (d.state === "missed") {
          ctx.globalAlpha = Math.max(0, 1 - (now - d.missedAt) / 2200);
          ctx.fillStyle = "rgba(15,23,42,0.85)"; roundRect(d.x - 110, ground - 70, 220, 56, 14); ctx.fill();
          ctx.strokeStyle = "#f87171"; ctx.lineWidth = 2; ctx.stroke();
          ctx.fillStyle = "#fecaca"; ctx.font = "600 13px system-ui"; ctx.textAlign = "center"; ctx.fillText(d.w.translation_vi, d.x, ground - 48);
          ctx.fillStyle = "#fde047"; ctx.font = "bold 22px system-ui"; ctx.fillText(d.w.word, d.x, ground - 22);
          ctx.globalAlpha = 1; continue;
        }
        const on = s.locked === d;
        ctx.fillStyle = on ? "rgba(99,102,241,0.55)" : "rgba(255,255,255,0.13)"; roundRect(x0, d.y, d.width, CARD_H, 16); ctx.fill();
        ctx.strokeStyle = on ? "#a5b4fc" : `hsla(${d.hue},80%,75%,0.8)`; ctx.lineWidth = on ? 3 : 2; ctx.stroke();
        ctx.fillStyle = "#fff"; ctx.font = "600 15px system-ui"; ctx.textAlign = "center";
        let label = `${d.w.emoji} ${d.w.translation_vi}`.trim();
        while (ctx.measureText(label).width > d.width - 16 && label.length > 4) label = label.slice(0, -2);
        ctx.fillText(label === `${d.w.emoji} ${d.w.translation_vi}`.trim() ? label : `${label}…`, d.x, d.y + 24);
        const n = d.w.word.length, total = n * (BOX + 4) - 4;
        for (let i = 0; i < n; i++) {
          const bx = d.x - total / 2 + i * (BOX + 4), by = d.y + 36, hit = i < d.typed;
          ctx.fillStyle = hit ? "#fde047" : "rgba(15,23,42,0.55)"; roundRect(bx, by, BOX, 28, 6); ctx.fill();
          ctx.strokeStyle = hit ? "#fff" : "rgba(255,255,255,0.55)"; ctx.lineWidth = 1.5; ctx.stroke();
          if (hit) { ctx.fillStyle = "#1f2937"; ctx.font = "bold 17px system-ui"; ctx.fillText((d.w.word[i] ?? "").toUpperCase(), bx + BOX / 2, by + 20); }
        }
      }
      for (const p of s.particles) { ctx.globalAlpha = 1 - p.life / p.max; ctx.fillStyle = `hsl(${p.hue},90%,70%)`; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, 7); ctx.fill(); }
      ctx.globalAlpha = 1;
      for (const p of s.pops) { ctx.globalAlpha = 1 - p.life / 1.1; ctx.fillStyle = p.color; ctx.font = "bold 20px system-ui"; ctx.textAlign = "center"; ctx.fillText(p.text, p.x, p.y); }
      ctx.globalAlpha = 1;
      if (s.flash > 0) { ctx.fillStyle = `rgba(239,68,68,${s.flash})`; ctx.fillRect(0, 0, w, h); }
      ctx.restore();
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [phase === "setup" || phase === "loading"]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------- pause / keyboard
  const pause = useCallback(() => { if (live.current.phase === "playing") { setPhase("paused"); stopSpeaking(); } }, []);
  const resume = useCallback(() => { if (live.current.phase === "paused") { setPhase("playing"); setTimeout(() => input.current?.focus(), 30); } }, []);
  useEffect(() => {
    const onHide = () => { if (document.hidden) pause(); };
    document.addEventListener("visibilitychange", onHide);
    return () => { document.removeEventListener("visibilitychange", onHide); stopSpeaking(); };
  }, [pause]);
  function exit() { g.current.over = true; stopSpeaking(); setPhase("setup"); }

  // ---------------------------------------------------------------- screens
  if (phase === "setup" || phase === "loading") {
    return (
      <div className="space-y-4">
        <Card className="space-y-1 text-sm text-slate-600 dark:text-slate-300">
          <p>🌧️ {t("Từ vựng rơi như những giọt mưa. Mỗi thẻ cho biết nghĩa tiếng Việt: hãy gõ từ tiếng Anh tương ứng trước khi nó chạm đất.")}</p>
          <p>⌨️ {t("Gõ đúng từng chữ cái để mở khóa các ô chữ. Gõ sai bị trừ điểm, sai 3 lần mất 1 mạng; để từ rơi xuống đất cũng mất 1 mạng.")}</p>
        </Card>
        <h2 className="font-semibold">{t("Chọn chủ đề")}</h2>
        <TopicPicker value={topic} onChange={(v) => { setTopic(v); setTopicLabel(v); }} />
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium">{t("Số mạng")}</span>
          {[3, 4, 5].map((n) => <button key={n} onClick={() => setLives(n)} className={`rounded-lg border-2 px-3 py-1.5 text-sm font-semibold ${lives === n ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300 dark:border-slate-700"}`}>{"❤️".repeat(n)}</button>)}
          <Button onClick={begin} disabled={start.isPending}>{start.isPending ? <Spinner /> : `▶ ${t("Bắt đầu")}`}</Button>
        </div>
        {start.error && <ErrorBox error={start.error} />}
      </div>
    );
  }

  const s = g.current;
  const btn = "rounded-lg bg-white/15 px-2.5 py-1 text-white backdrop-blur hover:bg-white/30";
  return (
    <div className="space-y-3">
      <div ref={box} className="relative w-full overflow-hidden rounded-2xl bg-[#050d2b]" style={{ height: "min(72vh, 560px)" }} onClick={() => input.current?.focus()}>
        <canvas ref={canvas} className="absolute inset-0 h-full w-full" aria-label={t("Màn chơi Mưa từ vựng")} />
        <input ref={input} value="" autoFocus autoComplete="off" autoCapitalize="off" spellCheck={false} aria-label={t("Gõ từ tiếng Anh")}
          className="absolute bottom-0 left-0 h-px w-px opacity-0"
          onChange={(e) => { for (const ch of e.target.value) typeChar(ch); }}
          onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); if (live.current.phase === "playing") pause(); else resume(); } }}
          onBlur={() => { if (live.current.phase === "playing") setTimeout(() => input.current?.focus(), 80); }} />

        <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-center justify-between gap-2 p-2 text-sm text-white">
          <div className="flex items-center gap-2"><span className="rounded-full bg-white/15 px-3 py-1 font-semibold">{t("Câu {a}/{b}", { a: Math.min(hud.done + 1, hud.total), b: hud.total })}</span><span className="rounded-full bg-white/15 px-3 py-1">{topicLabel || t("Tất cả chủ đề")}</span></div>
          <div className="flex items-center gap-2 font-bold"><span className="rounded-full bg-white/15 px-3 py-1">⭐ {hud.score}</span>{hud.combo >= 2 && <span className="rounded-full bg-pink-500/80 px-3 py-1">🔥 x{hud.combo}</span>}<span aria-label={t("Số mạng")}>{Array.from({ length: lives }, (_, i) => <span key={i}>{i < hud.lives ? "❤️" : "🖤"}</span>)}</span></div>
          <div className="pointer-events-auto flex gap-1.5">
            <button className={btn} onClick={() => (phase === "paused" ? resume() : pause())} aria-label={phase === "paused" ? t("Tiếp tục") : t("Tạm dừng")}>{phase === "paused" ? "▶" : "⏸"}</button>
            <button className={btn} onClick={() => setSound(!sound)} aria-pressed={sound} aria-label={t("Âm thanh")}>{sound ? "🔊" : "🔇"}</button>
            <button className={btn} onClick={exit} aria-label={t("Thoát")}>✕</button>
          </div>
        </div>

        {phase === "playing" && target && (
          <button className="absolute bottom-3 right-3 rounded-full bg-indigo-600/90 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-500" onClick={(e) => { e.stopPropagation(); speak(target.word); input.current?.focus(); }}>🔊 {t("Nghe từ")}</button>
        )}
        {phase === "paused" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60 text-white"><p className="text-3xl font-bold">⏸ {t("Tạm dừng")}</p><div className="flex gap-2"><Button onClick={resume}>{t("Tiếp tục")}</Button><Button variant="ghost" onClick={exit}>{t("Thoát")}</Button></div><p className="text-xs opacity-70">Esc</p></div>
        )}
        {phase === "result" && outcome && <div className="absolute inset-0 bg-black/40" />}
      </div>

      {phase === "result" && outcome && (
        <Card className="space-y-4">
          <p className="text-center text-2xl font-bold">{outcome.won ? t("🎉 Hoàn thành màn chơi!") : t("Hết mạng rồi, thử lại nhé!")}</p>
          <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
            {[[t("Điểm"), s.score], [t("Từ đúng"), `${s.completed}/${s.total}`], [t("Độ chính xác"), `${outcome.accuracy}%`], [t("Thời gian"), `${Math.floor(outcome.seconds / 60)}:${String(outcome.seconds % 60).padStart(2, "0")}`]].map(([l, v]) => (
              <div key={String(l)} className="rounded-xl bg-slate-100 p-3 dark:bg-slate-800"><p className="text-xs text-slate-500">{l}</p><p className="text-xl font-bold">{v}</p></div>
            ))}
          </div>
          <p className="text-center text-sm text-slate-500">{t("Combo cao nhất: {n}", { n: s.maxCombo })}{finish.data ? ` · +${finish.data.data.xp_awarded} XP${finish.data.data.is_record ? ` · 🏆 ${t("Kỷ lục mới!")}` : ""}` : ""}</p>
          {finish.error && <ErrorBox error={finish.error} />}
          <div>
            <h3 className="mb-2 font-semibold">{t("Từ đã học")}</h3>
            <ul className="grid gap-2 sm:grid-cols-2">
              {s.learned.map(({ w, ok }) => (
                <li key={w.id} className={`flex items-center gap-3 rounded-xl border-2 p-2 ${ok ? "border-green-500 bg-green-50 dark:bg-green-950/50" : "border-red-400 bg-red-50 dark:bg-red-950/50"}`}>
                  <span className="text-2xl">{w.emoji}</span>
                  <span className="min-w-0 flex-1"><b>{w.word}</b> <span className="text-xs text-slate-500">{w.phonetic}</span><span className="block truncate text-sm">{w.translation_vi}</span></span>
                  <span aria-label={ok ? t("Đúng") : t("Chưa thuộc")}>{ok ? "✓" : "✗"}</span>
                  <button className="rounded-full bg-indigo-600 px-2 py-1 text-white" onClick={() => speak(w.word)} aria-label={t("Nghe")}>🔊</button>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-wrap justify-center gap-2"><Button onClick={begin} disabled={start.isPending}>{t("Chơi lại")}</Button><Button variant="ghost" onClick={exit}>{t("Chọn chủ đề khác")}</Button></div>
        </Card>
      )}
      {phase !== "result" && <p className="text-center text-xs text-slate-500">{t("Gõ trực tiếp từ bàn phím. Esc để tạm dừng.")}</p>}
    </div>
  );
}
