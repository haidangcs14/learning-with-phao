"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { useAuth } from "@/store/auth-store";
import { useLang } from "@/store/lang-store";

const GROUPS = [
  { label: "Học", items: [["/vocabulary", "Từ vựng"], ["/flashcards", "Flashcard"], ["/ipa", "Bảng IPA"], ["/grammar", "Ngữ pháp"]] },
  { label: "Kỹ năng", items: [["/speaking", "Luyện nói"], ["/reading", "Đọc hiểu"], ["/listening", "Luyện nghe"], ["/writing", "Luyện viết"]] },
  { label: "Luyện tập", items: [["/quiz", "Quiz"], ["/games", "Trò chơi"], ["/exams", "Bài kiểm tra"]] },
  { label: "Cộng đồng", items: [["/leaderboard", "Xếp hạng"], ["/friends", "Bạn bè"]] },
] as const;

const ghost = "rounded-lg px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800";
const menuItem = (active: boolean) =>
  `flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm ${active ? "bg-indigo-50 font-medium text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300" : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"}`;
const menuTitle = "px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-400";

function Dropdown({ label, active, align = "left", title, children }:
  { label: ReactNode; active?: boolean; align?: "left" | "right"; title?: string; children: (close: () => void) => ReactNode }) {
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
      <button onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="menu" title={title}
        className={`${ghost} flex items-center gap-1 ${active ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300" : ""}`}>
        {label} <span className="text-[10px] opacity-60">▾</span>
      </button>
      {open && (
        <div role="menu" className={`absolute top-full z-40 mt-1 min-w-44 rounded-xl border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900 ${align === "right" ? "right-0" : "left-0"}`}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

function LangMenu() {
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

function ThemeMenu() {
  const t = useT();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <span className="h-8 w-14" />; // avoid a hydration mismatch before the saved theme is known
  const current = THEMES.find(([k]) => k === theme) ?? THEMES[2];
  return (
    <Dropdown align="right" title={t("Giao diện")} label={<span aria-hidden="true">{current[1]}</span>}>
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

export function Navbar() {
  const t = useT();
  const pathname = usePathname();
  const router = useRouter();
  const qc = useQueryClient();
  const { user, ready, clear } = useAuth();
  const [mobile, setMobile] = useState(false);
  useEffect(() => setMobile(false), [pathname]);

  async function logout() {
    await apiFetch("/auth/logout", { method: "POST" }).catch(() => undefined);
    clear();
    qc.clear();
    router.push("/");
  }
  const itemCls = (href: string) =>
    `block rounded-lg px-3 py-2 text-sm ${pathname.startsWith(href) ? "bg-indigo-50 font-medium text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300" : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"}`;

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/85 backdrop-blur dark:border-slate-800 dark:bg-slate-950/85">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
        <Link href={user ? "/" : "/"} className="flex items-center gap-2 font-bold text-indigo-600">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">P</span>
          <span className="hidden sm:inline">Học cùng Phao</span>
        </Link>

        <nav className="ml-4 hidden items-center gap-1 md:flex">
          {GROUPS.map((g) => (
            <Dropdown key={g.label} label={t(g.label)} active={g.items.some(([h]) => pathname.startsWith(h))}>
              {(close) => g.items.map(([href, label]) => <Link key={href} href={href} onClick={close} className={itemCls(href)}>{t(label)}</Link>)}
            </Dropdown>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <LangMenu />
          <ThemeMenu />
          {ready && (user ? (
            <Dropdown align="right" label={
              <span className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold uppercase text-white">{user.username.slice(0, 1)}</span>
                <span className="hidden max-w-24 truncate lg:inline">{user.username}</span>
              </span>}>
              {(close) => (
                <>
                  <Link href="/dashboard" onClick={close} className={itemCls("/dashboard")}>{t("Tổng quan")}</Link>
                  {user.role === "admin" && <Link href="/admin" onClick={close} className={itemCls("/admin")}>Admin</Link>}
                  <button onClick={() => { close(); void logout(); }} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-slate-100 dark:hover:bg-slate-800">{t("Đăng xuất")}</button>
                </>
              )}
            </Dropdown>
          ) : (
            <Link href="/login" className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700">{t("Đăng nhập")}</Link>
          ))}
          <button className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 md:hidden dark:border-slate-700"
            onClick={() => setMobile(!mobile)} aria-label="Menu" aria-expanded={mobile}>{mobile ? "✕" : "☰"}</button>
        </div>
      </div>

      {mobile && (
        <nav className="max-h-[70vh] space-y-3 overflow-y-auto border-t border-slate-200 p-3 md:hidden dark:border-slate-800">
          {GROUPS.map((g) => (
            <div key={g.label}>
              <p className={menuTitle}>{t(g.label)}</p>
              {g.items.map(([href, label]) => <Link key={href} href={href} className={itemCls(href)}>{t(label)}</Link>)}
            </div>
          ))}
        </nav>
      )}
    </header>
  );
}
