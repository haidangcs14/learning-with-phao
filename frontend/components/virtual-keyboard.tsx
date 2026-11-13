"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";

export type KeyStatus = "correct" | "present" | "absent";
const ROWS = [["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"], ["a", "s", "d", "f", "g", "h", "j", "k", "l"], ["Enter", "z", "x", "c", "v", "b", "n", "m", "Backspace"]];
const TONE: Record<KeyStatus, string> = {
  correct: "bg-green-600 text-white border-green-700", present: "bg-yellow-500 text-white border-yellow-600", absent: "bg-slate-500 text-white border-slate-600 opacity-70",
};

/** On-screen keyboard. It sends "a".."z", "Enter", "Backspace" (and " ", "-", "'" when `extra` is set) to `onKey`. */
export function VirtualKeyboard({ onKey, status, extra = false }: { onKey: (key: string) => void; status?: Record<string, KeyStatus>; extra?: boolean }) {
  const t = useT();
  const press = (k: string) => (e: React.PointerEvent) => { e.preventDefault(); onKey(k); }; // preventDefault keeps focus where it was
  const cls = "touch-manipulation select-none rounded-lg border-b-4 border-slate-300 bg-slate-100 py-3 text-sm font-bold uppercase text-slate-800 shadow-sm transition active:translate-y-0.5 active:border-b-2 sm:text-base dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";
  const rows = extra ? [...ROWS, ["-", "'", " "]] : ROWS;
  return (
    <div className="mx-auto w-full max-w-xl space-y-1.5" role="group" aria-label={t("Bàn phím ảo")}>
      {rows.map((row, i) => (
        <div key={i} className="flex justify-center gap-1">
          {row.map((k) => {
            const wide = k === "Enter" || k === "Backspace";
            const label = k === "Enter" ? "↵" : k === "Backspace" ? "⌫" : k === " " ? t("dấu cách") : k;
            return (
              <button key={k} type="button" onPointerDown={press(k)} onClick={(e) => { if (e.detail === 0) onKey(k); }} aria-label={k === "Enter" ? "Enter" : k === "Backspace" ? t("Xóa") : label}
                className={`${cls} ${wide ? "flex-[1.6] px-2" : k === " " ? "flex-[4]" : "flex-1"} ${status?.[k] ? TONE[status[k] as KeyStatus] : ""}`}>{label}</button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** Remembers whether the keyboard is shown. On touch screens it starts visible. */
export function useVirtualKeyboard(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(false);
  useEffect(() => {
    try {
      const saved = localStorage.getItem("vk.on");
      setOn(saved === null ? window.matchMedia("(pointer: coarse)").matches : saved === "1");
    } catch { /* ignore */ }
  }, []);
  return [on, (v) => { setOn(v); try { localStorage.setItem("vk.on", v ? "1" : "0"); } catch { /* ignore */ } }];
}

export function KeyboardToggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  const t = useT();
  return (
    <button type="button" onClick={() => onChange(!on)} aria-pressed={on} title={t("Bàn phím ảo")} aria-label={t("Bàn phím ảo")}
      className={`flex h-10 w-10 items-center justify-center rounded-xl border-2 text-lg transition ${on ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300 bg-white hover:border-indigo-400 dark:border-slate-700 dark:bg-slate-900"}`}>⌨</button>
  );
}
