"use client";

import Link from "next/link";
import { Empty, ErrorBox, Page, Spinner } from "@/components/ui";
import { useGet } from "@/hooks/api";
import { useT } from "@/lib/i18n";
import { useLang } from "@/store/lang-store";

interface Lesson { id: string; title: string; slug: string; level: string; description: string; group?: string; en?: { description?: string } }

const GROUPS = [["present", "Thì hiện tại"], ["past", "Thì quá khứ"], ["future", "Thì tương lai"], ["other", "Cấu trúc & chủ đề khác"]] as const;
const TIPS = [
  "Đọc tên thì từ phải sang trái để suy ra công thức.",
  "Tiếp diễn (continuous) → động từ to be + V-ing.",
  "Hoàn thành (perfect) → have/has/had + V3 (to be → been).",
  "Tương lai → thêm will phía trước. Ví dụ: tương lai hoàn thành tiếp diễn = will have been + V-ing.",
  "Thì hiện tại dùng V1, thì quá khứ dùng V2, thì tương lai luôn có will.",
];

export default function GrammarPage() {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const q = useGet<Lesson[]>("/grammar?limit=100");
  const items = q.data?.data ?? [];
  return (
    <Page title={t("Ngữ pháp")}>
      <details className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/60">
        <summary className="cursor-pointer font-semibold">💡 {t("Mẹo nhớ công thức 12 thì")}</summary>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-slate-700 dark:text-slate-300">{TIPS.map((x) => <li key={x}>{t(x)}</li>)}</ol>
      </details>
      {q.isLoading ? <Spinner /> : q.error ? <ErrorBox error={q.error} /> : items.length === 0 ? <Empty>{t("Chưa có bài ngữ pháp.")}</Empty> : (
        GROUPS.map(([g, label]) => {
          const list = items.filter((l) => (l.group ?? "other") === g);
          if (list.length === 0) return null;
          return (
            <section key={g}>
              <h2 className="mb-3 mt-2 text-xl font-semibold">{t(label)}</h2>
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                {list.map((l) => (
                  <Link key={l.id} href={`/grammar/${l.slug}`} className="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-indigo-500 hover:shadow dark:border-slate-800 dark:bg-slate-900/60">
                    <span className="rounded bg-indigo-100 px-2 py-0.5 text-xs text-indigo-800">{l.level}</span>
                    <h3 className="mt-2 font-semibold">{l.title}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{lang === "en" ? l.en?.description ?? l.description : l.description}</p>
                  </Link>
                ))}
              </div>
            </section>
          );
        })
      )}
    </Page>
  );
}
