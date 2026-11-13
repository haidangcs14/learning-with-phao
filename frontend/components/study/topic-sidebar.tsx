"use client";

import { useState } from "react";
import { tint } from "@/components/study/utils";
import { useT } from "@/lib/i18n";
import { topicInfo } from "@/lib/topics";
import { useLang } from "@/store/lang-store";

export interface TopicRow { topic: string; count: number; learned: number }

function Tile({ topic, size = 44 }: { topic: string; size?: number }) {
  const lang = useLang((s) => s.lang);
  return <span style={{ width: size, height: size, fontSize: size * 0.55 }} className={`flex shrink-0 items-center justify-center rounded-xl border-2 border-white bg-gradient-to-br shadow ${tint(topic)}`} aria-hidden="true">{topicInfo(topic, lang).icon}</span>;
}

/** Desktop: the "DANH SÁCH CHỦ ĐỀ" cards. Phones: a scrollable row of chips. */
export function TopicSidebar({ topics, active, onPick }: { topics: TopicRow[]; active: string; onPick: (topic: string) => void }) {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const toggle = (topic: string) => setClosed((s) => { const n = new Set(s); if (n.has(topic)) n.delete(topic); else n.add(topic); return n; });
  return (
    <>
      <nav className="flex gap-2 overflow-x-auto pb-2 lg:hidden" aria-label={t("Danh sách chủ đề")}>
        {topics.map((x) => (
          <button key={x.topic} onClick={() => onPick(x.topic)} aria-current={active === x.topic}
            className={`flex shrink-0 items-center gap-2 rounded-xl border-2 px-3 py-1.5 text-sm font-semibold ${active === x.topic ? "border-[#1e1b4b] bg-[#1e1b4b] text-white" : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"}`}>
            <span>{topicInfo(x.topic, lang).icon}</span><span className="whitespace-nowrap">{topicInfo(x.topic, lang).label}</span><span className="text-xs opacity-70">{x.learned}/{x.count}</span>
          </button>
        ))}
      </nav>
      <aside className="hidden rounded-3xl border-2 border-slate-200 bg-white p-4 shadow-[0_6px_0_-2px_rgba(148,163,184,0.4)] lg:sticky lg:top-20 lg:block lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto dark:border-slate-700 dark:bg-slate-900" aria-label={t("Danh sách chủ đề")}>
        <h2 className="mb-3 px-1 text-sm font-extrabold uppercase tracking-wide text-[#1e1b4b] dark:text-slate-100">{t("DANH SÁCH CHỦ ĐỀ")}</h2>
        <ul className="space-y-3">
          {topics.map((x) => {
            const on = active === x.topic, open = !closed.has(x.topic), pct = x.count ? (x.learned / x.count) * 100 : 0;
            return (
              <li key={x.topic}>
                <div className={`flex items-center gap-3 rounded-2xl border-2 p-2.5 shadow-[0_4px_0_-1px_rgba(148,163,184,0.5)] transition hover:-translate-y-0.5 ${on ? "border-[#1e1b4b] bg-[#1e1b4b] text-white" : "border-slate-200 bg-white hover:border-indigo-300 dark:border-slate-700 dark:bg-slate-900"}`}>
                  <button onClick={() => onPick(x.topic)} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-current={on}>
                    <Tile topic={x.topic} />
                    <span className="min-w-0"><span className="block truncate text-sm font-bold">{topicInfo(x.topic, lang).label}</span>
                      <span className={`block text-xs ${on ? "text-indigo-200" : "text-slate-500"}`}>{t("{a}/{b} thẻ", { a: x.learned, b: x.count })}</span></span>
                  </button>
                  <button onClick={() => toggle(x.topic)} aria-expanded={open} aria-label={open ? t("Thu gọn") : t("Mở rộng")}
                    className={`flex h-7 w-9 shrink-0 items-center justify-center rounded-lg border-2 text-sm font-bold ${on ? "border-indigo-300 bg-indigo-900 text-white" : "border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"}`}>{open ? "−" : "+"}</button>
                </div>
                {open && (
                  <div className="mx-2 mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
                    <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </aside>
    </>
  );
}
