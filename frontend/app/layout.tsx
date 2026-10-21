import type { Metadata } from "next";
import "./globals.css";
import { ChatWidget } from "@/components/chat-widget";
import { Navbar } from "@/components/navbar";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "Học cùng Phao",
  description: "Nền tảng học tiếng Anh miễn phí cho người Việt",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <Providers>
          <Navbar />
          {children}
          <ChatWidget />
        </Providers>
      </body>
    </html>
  );
}
