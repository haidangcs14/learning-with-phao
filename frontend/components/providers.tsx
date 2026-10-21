"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useEffect, useState, type ReactNode } from "react";
import { ConfirmProvider } from "@/components/confirm";
import { bootstrapSession } from "@/lib/api";
import { useLang, type Lang } from "@/store/lang-store";

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
  }));
  useEffect(() => { void bootstrapSession(); }, []); // restore the session from the refresh cookie
  useEffect(() => { // restore the saved language (default: Vietnamese)
    let saved: string | null = null;
    try { saved = localStorage.getItem("lang"); } catch { /* ignore */ }
    if (saved === "en" || saved === "vi") useLang.getState().setLang(saved as Lang);
  }, []);
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryClientProvider client={client}><ConfirmProvider>{children}</ConfirmProvider></QueryClientProvider>
    </ThemeProvider>
  );
}
