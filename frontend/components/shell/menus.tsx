"use client";

import { useTheme } from "next-themes";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useT } from "@/lib/i18n";
import { useLang } from "@/store/lang-store";

const ghost = "rounded-btn px-3 py-1.5 text-sm font-medium text-foreground hover:bg-surface-secondary";
const menuItem = (active: boolean) =>
  `flex w-full items-center justify-between gap-3 rounded-btn px-3 py-2 text-left text-sm ${active ? "bg-primary-soft font-medium text-primary-text" : "text-foreground hover:bg-surface-secondary"}`;
const menuTitle = "px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground";

export function Dropdown({ label, align = "left", title, children }: { label: ReactNode; align?: "left" | "right"; title?: string; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="menu" title={title} aria-label={title}
        className={`${ghost} flex h-9 items-center gap-1 ${open ? "bg-surface-secondary" : ""}`}>
        {label}
      </button>
      {open && (
        <div role="menu" className={`absolute top-full z-40 mt-2 min-w-44 rounded-card border border-border bg-surface p-1 shadow-hover ${align === "right" ? "right-0" : "left-0"}`}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export function LangMenu() {
  const t = useT();
  const { lang, setLang } = useLang();
  return (
    <Dropdown align="right" title={t("Ngôn ngữ")} label={<span className="text-xs font-bold">🌐 {lang.toUpperCase()}</span>}>
      {(close) => (
        <>
          <p className={menuTitle}>{t("Ngôn ngữ")}</p>
          {([["vi", "Tiếng Việt"], ["en", "English"]] as const).map(([code, name]) => (
            <button key={code} role="menuitemradio" aria-checked={lang === code} onClick={() => { setLang(code); close(); }} className={menuItem(lang === code)}>
              <span><b className="mr-2 inline-block w-5 text-xs">{code.toUpperCase()}</b>{name}</span>
              {lang === code && <span>✓</span>}
            </button>
          ))}
        </>
      )}
    </Dropdown>
  );
}

const THEMES = [["light", "☀️", "Sáng"], ["dark", "🌙", "Tối"], ["system", "💻", "Theo hệ thống"]] as const;

export function ThemeMenu() {
  const t = useT();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <span className="h-9 w-12" />; // avoid a hydration mismatch before the saved theme is known
  const current = THEMES.find(([k]) => k === theme) ?? THEMES[2];
  return (
    <Dropdown align="right" title={t("Giao diện")} label={<span className="text-base" aria-hidden="true">{current[1]}</span>}>
      {(close) => (
        <>
          <p className={menuTitle}>{t("Giao diện")}</p>
          {THEMES.map(([key, icon, name]) => (
            <button key={key} role="menuitemradio" aria-checked={theme === key} onClick={() => { setTheme(key); close(); }} className={menuItem(theme === key)}>
              <span><span className="mr-2">{icon}</span>{t(name)}</span>
              {theme === key && <span>✓</span>}
            </button>
          ))}
        </>
      )}
    </Dropdown>
  );
}
