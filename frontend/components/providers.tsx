"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ConfirmProvider } from "@/components/confirm";
import { GamificationWatcher } from "@/components/level-up";
import { bootstrapSession } from "@/lib/api";
import { useAuth } from "@/store/auth-store";
import { useLang, type Lang } from "@/store/lang-store";

/** Admin accounts only get the admin area (plus their profile and the exam preview/results). */
function RoleGuard() {
  const { user, ready } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    if (!ready || user?.role !== "admin") return;
    const allowed = pathname.startsWith("/admin") || pathname === "/profile" || pathname.startsWith("/oauth") || pathname.startsWith("/exams/");
    if (!allowed) router.replace("/admin");
  }, [ready, user, pathname, router]);
  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
  }));
  useEffect(() => { void bootstrapSession(); }, []);
  useEffect(() => { // lets list pages know the user came back with the Back button (to restore the scroll position)
    const mark = () => { try { sessionStorage.setItem("popped", String(Date.now())); } catch { /* ignore */ } };
    window.addEventListener("popstate", mark);
    return () => window.removeEventListener("popstate", mark);
  }, []); // restore the session from the refresh cookie
  useEffect(() => { // restore the saved language (default: Vietnamese)
    let saved: string | null = null;
    try { saved = localStorage.getItem("lang"); } catch { /* ignore */ }
    if (saved === "en" || saved === "vi") useLang.getState().setLang(saved as Lang);
  }, []);
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryClientProvider client={client}><ConfirmProvider><RoleGuard /><GamificationWatcher />{children}</ConfirmProvider></QueryClientProvider>
    </ThemeProvider>
  );
}
