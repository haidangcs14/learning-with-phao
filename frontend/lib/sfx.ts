"use client";

import { useEffect, useState } from "react";

let ctx: AudioContext | null = null;

/** A short synthesised beep (no audio files needed). Only works after the first click/key press, as browsers require. */
export function tone(freq: number, ms = 120, type: OscillatorType = "sine", gain = 0.05, delay = 0): void {
  try {
    ctx ??= new (window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator(), amp = ctx.createGain();
    osc.type = type; osc.frequency.value = freq;
    amp.gain.setValueAtTime(gain, t0); amp.gain.exponentialRampToValueAtTime(0.0001, t0 + ms / 1000);
    osc.connect(amp).connect(ctx.destination);
    osc.start(t0); osc.stop(t0 + ms / 1000);
  } catch { /* audio not available */ }
}
export const sfx = {
  ok: () => { tone(660, 90); tone(880, 130, "sine", 0.05, 0.08); },
  key: () => tone(520, 50, "triangle", 0.03),
  bad: () => tone(150, 240, "sawtooth", 0.05),
  pop: () => { tone(740, 70, "square", 0.03); tone(990, 110, "triangle", 0.04, 0.06); },
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 160, "triangle", 0.05, i * 0.13)),
  lose: () => [330, 262, 196].forEach((f, i) => tone(f, 220, "sawtooth", 0.05, i * 0.18)),
};

/** Sound on/off, remembered between visits. */
export function useSound(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(true);
  useEffect(() => { try { setOn(localStorage.getItem("game.sound") !== "off"); } catch { /* ignore */ } }, []);
  return [on, (v) => { setOn(v); try { localStorage.setItem("game.sound", v ? "on" : "off"); } catch { /* ignore */ } }];
}
