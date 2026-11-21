"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { NotificationBell } from "@/components/notification-bell";
import { GlobalSearch } from "@/components/shell/global-search";
import { LangMenu, ThemeMenu } from "@/components/shell/menus";
import { Sidebar } from "@/components/shell/sidebar";
import { useT } from "@/lib/i18n";
import { useAuth } from "@/store/auth-store";

function Topbar({ signedIn, onMenu }: { signedIn: boolean; onMenu: () => void }) {
  const t = useT();
  return (
    <header className="sticky top-3 z-30 mx-3 mt-3 flex h-14 items-center gap-3 rounded-[1.25rem] border-2 border-border bg-surface/90 px-3 shadow-raised backdrop-blur sm:px-4">
      {signedIn && <button onClick={onMenu} aria-label={t("Mở menu")} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-btn border border-border text-lg hover:bg-surface-secondary lg:hidden">☰</button>}
      <Link href="/" aria-label={t("Trang chủ")} className={`flex shrink-0 items-center gap-2 font-bold text-primary-text ${signedIn ? "lg:hidden" : ""}`}>
        <span className="flex h-9 w-9 items-center justify-center rounded-btn bg-primary text-primary-foreground shadow-raised">P</span>
        <span className={signedIn ? "hidden" : "hidden sm:inline"}>Học cùng Phao</span>
      </Link>
      {signedIn && <div className="hidden min-w-0 flex-1 sm:block"><GlobalSearch /></div>}
      <div className="ml-auto flex items-center gap-1.5">
        {signedIn && <NotificationBell />}
        <LangMenu />
        <ThemeMenu />
        {!signedIn && <Link href="/login" className="lift rounded-btn bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-raised hover:bg-primary-hover">{t("Đăng nhập")}</Link>}
      </div>
    </header>
  );
}

/** Vertical navigation on the left (signed-in users), a slim bar on top (search, language, theme, notifications) and the page. */
export function AppShell({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  const pathname = usePathname();
  const [drawer, setDrawer] = useState(false);
  useEffect(() => setDrawer(false), [pathname]);
  const signedIn = ready && user !== null;
  return (
    <div className="min-h-screen lg:flex">
      {signedIn && <Sidebar open={drawer} onClose={() => setDrawer(false)} />}
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <Topbar signedIn={signedIn} onMenu={() => setDrawer(true)} />
        {signedIn && <div className="mx-3 mt-2 rounded-[1.25rem] border border-border bg-surface/90 p-2 shadow-soft sm:hidden"><GlobalSearch /></div>}
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
