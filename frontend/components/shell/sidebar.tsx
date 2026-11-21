"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { LevelAvatar } from "@/components/avatar";
import { ADMIN_ITEMS, HOME_ITEM, PROFILE_ITEM, SECTIONS, type NavItem } from "@/components/shell/nav-config";
import { useGet } from "@/hooks/api";
import { apiFetch } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { displayName } from "@/lib/level";
import { useAuth } from "@/store/auth-store";

/** The vertical navigation: logo (home), the user, the sections and "sign out". On phones it is a drawer. */
export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const pathname = usePathname();
  const router = useRouter();
  const qc = useQueryClient();
  const { user, clear } = useAuth();
  const isAdmin = user?.role === "admin";
  const xp = useGet<{ level: number }>(user && !isAdmin ? "/leaderboard/me" : null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!user) return null;

  async function logout() {
    await apiFetch("/auth/logout", { method: "POST" }).catch(() => undefined);
    clear();
    qc.clear();
    router.push("/");
  }
  const isActive = (href: string) => (href === "/admin" || href === "/dashboard" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));
  const item = ([href, label, icon]: NavItem) => {
    const on = isActive(href);
    return (
      <Link key={href} href={href} aria-current={on ? "page" : undefined}
        className={`flex items-center gap-3 rounded-btn px-3 py-2 text-sm font-semibold transition duration-150 ${on ? "bg-primary-soft text-primary-text shadow-soft" : "text-foreground hover:bg-surface-secondary"}`}>
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-btn text-base ${on ? "bg-surface shadow-soft" : "bg-surface-secondary"}`} aria-hidden="true">{icon}</span>
        <span className="min-w-0 truncate">{t(label)}</span>
      </Link>
    );
  };
  const title = "mb-1 px-3 text-xs font-bold uppercase tracking-wider text-muted-foreground";

  const body = (
    <div className="flex h-full flex-col">
      <div className="px-5 pb-2 pt-5">
        <Link href="/" className="flex items-center gap-2.5 text-lg font-bold text-primary-text" aria-label={t("Trang chủ")}>
          <span className="flex h-9 w-9 items-center justify-center rounded-btn bg-primary text-primary-foreground shadow-raised">P</span>
          {isAdmin ? "Phao Admin" : "Học cùng Phao"}
        </Link>
      </div>
      <Link href="/profile" className="mx-3 mb-1 flex flex-col items-center gap-0.5 rounded-card px-3 py-3 text-center transition hover:bg-surface-secondary">
        <LevelAvatar user={user} level={isAdmin ? undefined : xp.data?.data.level} size={64} />
        <span className="mt-1 max-w-full truncate font-bold">{displayName(user)}</span>
        <span className="text-xs font-semibold text-muted-foreground">{isAdmin ? t("Quản trị viên") : t("Học viên")}</span>
      </Link>
      <nav className="mt-1 flex-1 space-y-5 overflow-y-auto px-3 pb-4" aria-label={t("Điều hướng chính")}>
        {isAdmin ? (
          <div><p className={title}>{t("Quản trị")}</p><div className="space-y-0.5">{ADMIN_ITEMS.map(item)}</div></div>
        ) : (
          <>
            <div className="space-y-0.5">{item(HOME_ITEM)}</div>
            {SECTIONS.map((s) => <div key={s.label}><p className={title}>{t(s.label)}</p><div className="space-y-0.5">{s.items.map(item)}</div></div>)}
          </>
        )}
        <div><p className={title}>{t("Tài khoản")}</p><div className="space-y-0.5">{item(PROFILE_ITEM)}</div></div>
      </nav>
      <div className="border-t-2 border-dashed border-border p-3">
        <button onClick={() => void logout()} className="flex w-full items-center gap-3 rounded-btn px-3 py-2 text-sm font-bold text-error-text hover:bg-error-soft">
          <span className="flex h-8 w-8 items-center justify-center rounded-btn bg-error-soft" aria-hidden="true">🚪</span>{t("Đăng xuất")}
        </button>
      </div>
    </div>
  );

  return (
    <>
      <div className="sticky top-0 z-40 hidden h-screen shrink-0 p-3 lg:block">
        <aside className="h-full w-64 overflow-hidden rounded-[1.5rem] border-2 border-border bg-surface shadow-raised">{body}</aside>
      </div>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={t("Điều hướng chính")}>
          <div className="absolute inset-0 bg-overlay/60" onClick={onClose} />
          <aside className="animate-modal absolute inset-y-3 left-3 w-72 max-w-[85vw] overflow-hidden rounded-[1.5rem] border-2 border-border bg-surface shadow-hover">
            <button onClick={onClose} aria-label={t("Đóng menu")} className="absolute right-3 top-4 flex h-9 w-9 items-center justify-center rounded-btn border border-border bg-surface hover:bg-surface-secondary">✕</button>
            {body}
          </aside>
        </div>
      )}
    </>
  );
}
