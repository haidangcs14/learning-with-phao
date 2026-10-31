"use client";

import { Spinner } from "@/components/ui";
import { useGet } from "@/hooks/api";
import { useT } from "@/lib/i18n";
import { topicInfo } from "@/lib/topics";
import { useLang } from "@/store/lang-store";

/** Grid of vocabulary topics ("" = all topics). */
export function TopicPicker({ value, onChange }: { value: string; onChange: (topic: string) => void }) {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const q = useGet<{ topic: string; count: number }[]>("/words/topics");
  if (q.isLoading) return <Spinner />;
  const items = q.data?.data ?? [];
  const cls = (on: boolean) => `flex items-center gap-2 rounded-xl border-2 p-3 text-left text-sm transition ${on ? "border-indigo-600 bg-indigo-50 font-semibold dark:bg-indigo-950" : "border-slate-200 bg-white hover:border-indigo-400 dark:border-slate-800 dark:bg-slate-900/60"}`;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4" role="radiogroup" aria-label={t("Chủ đề")}>
      <button role="radio" aria-checked={value === ""} onClick={() => onChange("")} className={cls(value === "")}><span className="text-xl">📚</span><span>{t("Tất cả chủ đề")}</span></button>
      {items.map((x) => {
        const info = topicInfo(x.topic, lang);
        return (
          <button key={x.topic} role="radio" aria-checked={value === x.topic} onClick={() => onChange(x.topic)} className={cls(value === x.topic)}>
            <span className="text-xl">{info.icon}</span>
            <span className="min-w-0"><span className="block truncate">{info.label}</span><span className="block text-xs font-normal text-slate-500">{t("{n} từ", { n: x.count })}</span></span>
          </button>
        );
      })}
    </div>
  );
}
