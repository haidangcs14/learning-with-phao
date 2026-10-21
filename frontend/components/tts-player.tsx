"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { useT } from "@/lib/i18n";

interface Line { speaker?: string | null; text: string }
const RATES = [0.7, 0.85, 1, 1.15];

/** Reads a script aloud with the browser's speech synthesis (no audio files needed). */
export function TtsPlayer({ lines, showText }: { lines: Line[]; showText: boolean }) {
  const t = useT();
  const [supported, setSupported] = useState(true);
  const [state, setState] = useState<"idle" | "playing" | "paused">("idle");
  const [current, setCurrent] = useState(-1);
  const [rate, setRate] = useState(1);
  const [accent, setAccent] = useState("en-GB");
  const voices = useRef<SpeechSynthesisVoice[]>([]);
  const run = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) { setSupported(false); return; }
    const synth = window.speechSynthesis;
    const load = () => { voices.current = synth.getVoices().filter((v) => v.lang.toLowerCase().startsWith("en")); };
    load();
    synth.addEventListener("voiceschanged", load);
    return () => { synth.removeEventListener("voiceschanged", load); run.current++; synth.cancel(); };
  }, []);

  const speakFrom = useCallback((from: number, r: number, a: string) => {
    const synth = window.speechSynthesis;
    const id = ++run.current; // callbacks of older runs check this id and stop
    synth.cancel();
    const speakers = [...new Set(lines.map((l) => l.speaker ?? ""))];
    const pool = voices.current.filter((v) => v.lang.replace("_", "-").toLowerCase() === a.toLowerCase());
    const usable = pool.length ? pool : voices.current;
    const play = (i: number) => {
      if (id !== run.current) return;
      const line = lines[i];
      if (!line) { setState("idle"); setCurrent(-1); return; }
      const u = new SpeechSynthesisUtterance(line.text);
      u.lang = a;
      u.rate = r;
      const si = speakers.indexOf(line.speaker ?? "");
      const voice = usable.length ? usable[si % usable.length] : undefined;
      if (voice) u.voice = voice;
      if (speakers.length > 1 && usable.length < 2) u.pitch = si % 2 === 0 ? 1 : 1.35; // one voice only: vary the pitch per speaker
      u.onstart = () => { if (id === run.current) setCurrent(i); };
      u.onend = () => play(i + 1);
      u.onerror = () => { if (id === run.current) setState("idle"); };
      synth.speak(u);
    };
    setState("playing");
    setTimeout(() => play(from), 60); // Chrome needs a short gap after cancel()
  }, [lines]);

  function stop() { run.current++; window.speechSynthesis.cancel(); setState("idle"); setCurrent(-1); }
  function toggle() {
    const synth = window.speechSynthesis;
    if (state === "idle") speakFrom(0, rate, accent);
    else if (state === "playing") { synth.pause(); setState("paused"); }
    else { synth.resume(); setState("playing"); }
  }
  function change(r: number, a: string) {
    setRate(r); setAccent(a);
    if (state !== "idle") speakFrom(Math.max(current, 0), r, a); // keep listening from the current line with the new settings
  }

  if (!supported) return <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">{t("Trình duyệt của bạn không hỗ trợ đọc văn bản thành giọng nói. Hãy dùng Chrome, Edge hoặc Safari.")}</p>;
  const select = "rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";
  return (
    <div className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={toggle}>{state === "playing" ? t("⏸ Tạm dừng") : state === "paused" ? t("▶ Tiếp tục") : t("▶ Nghe")}</Button>
        <Button variant="ghost" onClick={stop} disabled={state === "idle"}>⏹</Button>
        <label className="ml-auto flex items-center gap-1 text-sm">{t("Tốc độ")}
          <select className={select} value={rate} onChange={(e) => change(Number(e.target.value), accent)}>{RATES.map((r) => <option key={r} value={r}>{r}x</option>)}</select>
        </label>
        <label className="flex items-center gap-1 text-sm">{t("Giọng")}
          <select className={select} value={accent} onChange={(e) => change(rate, e.target.value)}><option value="en-GB">UK</option><option value="en-US">US</option></select>
        </label>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
        <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${lines.length ? ((current + 1) / lines.length) * 100 : 0}%` }} />
      </div>
      {showText && (
        <ul className="space-y-2 text-sm">
          {lines.map((l, i) => (
            <li key={i} className={`rounded-lg px-3 py-2 ${i === current ? "bg-indigo-100 dark:bg-indigo-950" : ""}`}>
              {l.speaker && <b className="mr-1">{l.speaker}:</b>}{l.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
