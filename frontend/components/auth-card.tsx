"use client";

import { useCallback, useState, type ReactNode } from "react";

/** Centered card on a soft gradient. `shake` plays the "wrong input" shake animation once. */
export function AuthCard({ title, subtitle, shake, onShakeEnd, children }:
  { title: string; subtitle?: string; shake: boolean; onShakeEnd: () => void; children: ReactNode }) {
  return (
    <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-gradient-to-br from-primary-soft via-surface to-secondary-soft px-4 py-10">
      <div onAnimationEnd={onShakeEnd}
        className={`w-full max-w-md rounded-card border border-border bg-surface p-6 shadow-xl sm:p-8 ${shake ? "animate-shake" : ""}`}>
        <div className="mb-5 text-center">
          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-xl font-bold text-primary-foreground">P</span>
          <h1 className="text-2xl font-bold">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {children}
      </div>
    </main>
  );
}

/** Runs the shake once: `[shake, trigger, done]`. */
export function useShake(): [boolean, () => void, () => void] {
  const [shake, setShake] = useState(false);
  const trigger = useCallback(() => {
    setShake(false);
    requestAnimationFrame(() => setShake(true)); // restart the animation even if it is already playing
  }, []);
  const done = useCallback(() => setShake(false), []);
  return [shake, trigger, done];
}
