"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";

const OPTIONS = [["light", "☀️", "Sáng"], ["dark", "🌙", "Tối"], ["system", "💻", "Theo hệ thống"]] as const;

/** Light / Dark / System. "System" follows the operating system and updates by itself when the OS theme changes;
 *  a manual choice wins and is remembered (localStorage, applied before the first paint by next-themes: no flash). */
export function ThemeSwitcher() {
  const t = useT();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="h-12" aria-hidden="true" />;
  const current = theme ?? "system";
  return (
    <div className="space-y-2">
      <div role="radiogroup" aria-label={t("Giao diện")} className="inline-flex flex-wrap gap-1 rounded-card border border-border bg-surface-secondary p-1">
        {OPTIONS.map(([key, icon, label]) => (
          <button key={key} role="radio" aria-checked={current === key} onClick={() => setTheme(key)}
            className={`flex items-center gap-2 rounded-btn px-4 py-2 text-sm font-semibold transition duration-150 ${current === key ? "bg-surface text-primary-text shadow-soft ring-1 ring-primary/40" : "text-muted-foreground hover:bg-surface hover:text-foreground"}`}>
            <span aria-hidden="true">{icon}</span>{t(label)}
          </button>
        ))}
      </div>
      {current === "system" && <p className="text-xs text-muted-foreground">{t("Đang theo hệ thống: giao diện {m}.", { m: resolvedTheme === "dark" ? t("Tối") : t("Sáng") })}</p>}
    </div>
  );
}
