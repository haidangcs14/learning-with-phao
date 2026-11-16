"use client";

import type { ReactNode } from "react";

export function FlipCard({ flipped, onFlip, front, back, label }:
  { flipped: boolean; onFlip: () => void; front: ReactNode; back: ReactNode; label: string }) {
  return (
    <div className="flip-scene h-64 w-full cursor-pointer select-none sm:h-72" onClick={onFlip} role="button" tabIndex={0} aria-label={label}
      onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); onFlip(); } }}>
      <div className={`flip-inner h-full w-full ${flipped ? "is-flipped" : ""}`}>
        <div className="flip-face flex flex-col items-center justify-center gap-2 rounded-card border border-border bg-surface p-6 text-center text-foreground shadow-lg">{front}</div>
        <div className="flip-face flip-back flex flex-col items-center justify-center gap-2 overflow-y-auto rounded-2xl border border-primary/40 bg-primary-soft p-6 text-center text-foreground shadow-lg">{back}</div>
      </div>
    </div>
  );
}
