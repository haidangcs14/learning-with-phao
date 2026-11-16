"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";

export type KeyStatus = "correct" | "present" | "absent";
const ROWS = [["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"], ["a", "s", "d", "f", "g", "h", "j", "k", "l"], ["Enter", "z", "x", "c", "v", "b", "n", "m", "Backspace"]];
const TONE: Record<KeyStatus, string> = {
  correct: "bg-success text-success-foreground border-success", present: "bg-accent text-accent-foreground border-accent", absent: "bg-muted-foreground text-accent-foreground border-border opacity-70",
};

/** On-screen keyboard. It sends "a".."z", "Enter", "Backspace" (and " ", "-", "'" when `extra` is set) to `onKey`. */
export function VirtualKeyboard({ onKey, status, extra = false }: { onKey: (key: string) => void; status?: Record<string, KeyStatus>; extra?: boolean }) {
  const t = useT();
  const press = (k: string) => (e: React.PointerEvent) => { e.preventDefault(); onKey(k); }; // preventDefault keeps focus where it was
  const cls = "touch-manipulation select-none rounded-btn border-b-4 border-border bg-surface-secondary py-3 text-sm font-bold uppercase text-foreground shadow-sm transition active:translate-y-0.5 active:border-b-2 sm:text-base";
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
      className={`flex h-10 w-10 items-center justify-center rounded-xl border-2 text-lg transition ${on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface hover:border-primary"}`}>⌨</button>
  );
}
