import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";
import { ChatWidget } from "@/components/chat-widget";
import { Navbar } from "@/components/navbar";
import { Providers } from "@/components/providers";

// Nunito: friendly and rounded. 400 body, 500 labels, 600 sub-headings, 700 headings. Self-hosted by Next (no layout shift).
const nunito = Nunito({ subsets: ["latin", "vietnamese"], weight: ["400", "500", "600", "700"], display: "swap", variable: "--font-nunito" });

export const viewport: Viewport = {
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#F0FDFA" }, { media: "(prefers-color-scheme: dark)", color: "#0F172A" }],
};

export const metadata: Metadata = {
  title: "Học cùng Phao",
  description: "Nền tảng học tiếng Anh miễn phí cho người Việt",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" suppressHydrationWarning className={nunito.variable}>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <Providers>
          <Navbar />
          {children}
          <ChatWidget />
        </Providers>
      </body>
    </html>
  );
}
