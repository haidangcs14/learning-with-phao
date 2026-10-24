"use client";

import { useEffect, useRef, useState } from "react";

/** useState that survives navigation inside the tab: coming back to a list restores its filters and page. */
export function usePersistedState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const loaded = useRef(false);
  useEffect(() => {
    try { const s = sessionStorage.getItem(`ps:${key}`); if (s !== null) setValue(JSON.parse(s) as T); } catch { /* ignore */ }
    loaded.current = true;
  }, [key]);
  useEffect(() => {
    if (!loaded.current) return;
    try { sessionStorage.setItem(`ps:${key}`, JSON.stringify(value)); } catch { /* ignore */ }
  }, [key, value]);
  return [value, setValue] as const;
}

/** Remembers the scroll position of a list and restores it only when the user came back (browser/Back button). */
export function useRestoreScroll(key: string, ready: boolean) {
  useEffect(() => {
    const onScroll = () => { try { sessionStorage.setItem(`scroll:${key}`, String(window.scrollY)); } catch { /* ignore */ } };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [key]);
  const done = useRef(false);
  useEffect(() => {
    if (!ready || done.current) return;
    done.current = true;
    try {
      const cameBack = Date.now() - Number(sessionStorage.getItem("popped") ?? 0) < 4000; // set by the popstate listener in Providers
      const y = Number(sessionStorage.getItem(`scroll:${key}`) ?? 0);
      if (cameBack && y > 0) requestAnimationFrame(() => window.scrollTo(0, y));
    } catch { /* ignore */ }
  }, [ready, key]);
}
