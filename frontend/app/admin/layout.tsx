"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Protected } from "@/components/protected";
import { useT } from "@/lib/i18n";

const LINKS = [["/admin", "Dashboard"], ["/admin/users", "Người dùng"], ["/admin/words", "Từ vựng"], ["/admin/questions", "Câu hỏi"], ["/admin/exams", "Bài kiểm tra"]] as const;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const t = useT();
  const pathname = usePathname();
  return (
    <Protected admin>
      <div className="mx-auto max-w-5xl px-4 pt-4">
        <div className="flex gap-2 border-b border-slate-200 pb-2 text-sm font-medium dark:border-slate-800">
          {LINKS.map(([href, label]) => (
            <Link key={href} href={href} className={`rounded-lg px-3 py-1.5 ${pathname === href || (href !== "/admin" && pathname.startsWith(href)) ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300" : "hover:bg-slate-100 dark:hover:bg-slate-800"}`}>{t(label)}</Link>
          ))}
        </div>
      </div>
      {children}
    </Protected>
  );
}
