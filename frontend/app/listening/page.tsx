"use client";

import Link from "next/link";
import { PracticeList } from "@/components/practice/practice-list";
import { useT } from "@/lib/i18n";

export default function Page() {
  const t = useT();
  return (
    <>
      <div className="mx-auto max-w-5xl px-4 pt-6">
        <Link href="/listening/video" className="flex items-center justify-between gap-3 rounded-xl border-2 border-indigo-200 bg-indigo-50 p-4 transition hover:border-indigo-500 dark:border-indigo-900 dark:bg-indigo-950/40">
          <span><b>🎬 {t("Luyện nghe qua video YouTube")}</b><span className="block text-sm text-slate-600 dark:text-slate-300">{t("Gõ lại những gì bạn nghe được, chọn độ khó Easy / Normal / Hard.")}</span></span>
          <span aria-hidden="true" className="text-xl">→</span>
        </Link>
      </div>
      <PracticeList kind="listening" />
    </>
  );
}
