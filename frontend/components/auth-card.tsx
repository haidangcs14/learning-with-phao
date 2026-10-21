"use client";

import { useCallback, useState, type ReactNode } from "react";

/** Centered card on a soft gradient. `shake` plays the "wrong input" shake animation once. */
export function AuthCard({ title, subtitle, shake, onShakeEnd, children }:
  { title: string; subtitle?: string; shake: boolean; onShakeEnd: () => void; children: ReactNode }) {
  return (
    <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-pink-50 px-4 py-10 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950">
      <div onAnimationEnd={onShakeEnd}
        className={`w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8 dark:border-slate-700 dark:bg-slate-900 ${shake ? "animate-shake" : ""}`}>
        <div className="mb-5 text-center">
          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-xl font-bold text-white">P</span>
          <h1 className="text-2xl font-bold">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
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
