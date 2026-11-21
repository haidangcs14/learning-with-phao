"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ADMIN_ITEMS, HOME_ITEM, PROFILE_ITEM, SECTIONS } from "@/components/shell/nav-config";
import { useGet } from "@/hooks/api";
import { useT } from "@/lib/i18n";
import { useAuth } from "@/store/auth-store";
import type { Word } from "@/types";

const plain = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").toLowerCase(); // "ngu phap" finds "Ngữ pháp"
interface Result { key: string; href: string; icon: string; title: string; sub?: string; group: "pages" | "words" }

/** Jump to a page or look a word up. Arrow keys + Enter work, Esc closes, "/" focuses the box. */
export function GlobalSearch() {
  const t = useT();
  const router = useRouter();
  const isAdmin = useAuth((s) => s.user?.role === "admin");
  const [q, setQ] = useState("");
  const [settled, setSettled] = useState("");
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { const id = setTimeout(() => setSettled(q.trim()), 250); return () => clearTimeout(id); }, [q]);
  const words = useGet<Word[]>(!isAdmin && settled.length >= 2 ? `/words?q=${encodeURIComponent(settled)}&limit=5` : null);

  const pages = useMemo(() => (isAdmin ? [...ADMIN_ITEMS] : [HOME_ITEM, ...SECTIONS.flatMap((s) => s.items), PROFILE_ITEM]), [isAdmin]);
  const results: Result[] = useMemo(() => {
    const needle = plain(q.trim());
    if (!needle) return [];
    const p = pages.filter(([, label]) => plain(t(label)).includes(needle) || plain(label).includes(needle)).slice(0, 5)
      .map(([href, label, icon]): Result => ({ key: `p-${href}`, href, icon, title: t(label), group: "pages" }));
    const w = settled === q.trim() ? (words.data?.data ?? []).map((x): Result => ({ key: `w-${x.id}`, href: `/vocabulary/${x.id}`, icon: x.emoji || "📘", title: x.word, sub: x.meanings[0]?.translation_vi, group: "words" })) : [];
    return [...p, ...w];
  }, [q, settled, pages, words.data, t]);

  useEffect(() => setCursor(0), [q]);
  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const onSlash = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) && !el.isContentEditable) { e.preventDefault(); input.current?.focus(); }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onSlash);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onSlash); };
  }, []);

  function go(r: Result) { setOpen(false); setQ(""); input.current?.blur(); router.push(r.href); }
  function onKey(e: React.KeyboardEvent) {
    if (e.key === "Escape") { setOpen(false); input.current?.blur(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setCursor((c) => Math.min(c + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
    else if (e.key === "Enter" && results[cursor]) { e.preventDefault(); go(results[cursor]); }
  }
  const showPanel = open && q.trim().length > 0;
  const heading = (g: "pages" | "words") => (g === "pages" ? t("Trang") : t("Từ vựng"));

  return (
    <div ref={box} className="relative w-full max-w-md">
      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true">🔍</span>
        <input ref={input} value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onKeyDown={onKey}
          role="combobox" aria-expanded={showPanel} aria-controls="global-search-list" aria-autocomplete="list" aria-label={t("Tìm kiếm trang, từ vựng...")}
          placeholder={t("Tìm kiếm trang, từ vựng...")} autoComplete="off" maxLength={60}
          className="w-full rounded-full border-2 border-input bg-surface py-2 pl-10 pr-10 text-sm text-foreground placeholder:text-muted-foreground transition hover:border-primary/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30" />
        {!q && <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-border px-1.5 text-[11px] font-semibold text-muted-foreground sm:block">/</kbd>}
      </div>
      {showPanel && (
        <div className="absolute left-0 top-full z-40 mt-2 w-full overflow-hidden rounded-card border border-border bg-surface shadow-hover">
          {results.length === 0 ? <p className="p-4 text-sm text-muted-foreground">{words.isFetching ? t("Đang tải...") : t("Không tìm thấy kết quả.")}</p> : (
            <ul id="global-search-list" role="listbox" className="max-h-80 overflow-y-auto p-1">
              {results.map((r, i) => (
                <li key={r.key} role="presentation">
                  {(i === 0 || results[i - 1]?.group !== r.group) && <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{heading(r.group)}</p>}
                  <button role="option" aria-selected={i === cursor} onMouseEnter={() => setCursor(i)} onClick={() => go(r)}
                    className={`flex w-full items-center gap-3 rounded-btn px-3 py-2 text-left text-sm ${i === cursor ? "bg-primary-soft text-primary-text" : "hover:bg-surface-secondary"}`}>
                    <span className="text-lg" aria-hidden="true">{r.icon}</span>
                    <span className="min-w-0"><b className="block truncate">{r.title}</b>{r.sub && <span className="block truncate text-xs text-muted-foreground">{r.sub}</span>}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
