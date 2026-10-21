"use client";

import type { ReactNode } from "react";

export function FlipCard({ flipped, onFlip, front, back, label }:
  { flipped: boolean; onFlip: () => void; front: ReactNode; back: ReactNode; label: string }) {
  return (
    <div className="flip-scene h-64 w-full cursor-pointer select-none sm:h-72" onClick={onFlip} role="button" tabIndex={0} aria-label={label}
      onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); onFlip(); } }}>
      <div className={`flip-inner h-full w-full ${flipped ? "is-flipped" : ""}`}>
        <div className="flip-face flex flex-col items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-900 shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">{front}</div>
        <div className="flip-face flip-back flex flex-col items-center justify-center gap-2 rounded-2xl border border-indigo-200 bg-indigo-50 p-6 text-center text-slate-900 shadow-lg dark:border-indigo-800 dark:bg-indigo-950 dark:text-slate-100">{back}</div>
      </div>
    </div>
  );
}
