"use client";

import { useState } from "react";
import { tint } from "@/components/study/utils";
import { useT } from "@/lib/i18n";
import { topicInfo } from "@/lib/topics";
import { useLang } from "@/store/lang-store";

export interface TopicRow { topic: string; count: number; learned: number }

function Tile({ topic, size = 44 }: { topic: string; size?: number }) {
  const lang = useLang((s) => s.lang);
  return <span style={{ width: size, height: size, fontSize: size * 0.55 }} className={`flex shrink-0 items-center justify-center rounded-xl border-2 border-surface bg-gradient-to-br shadow ${tint(topic)}`} aria-hidden="true">{topicInfo(topic, lang).icon}</span>;
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
            className={`flex shrink-0 items-center gap-2 rounded-btn border-2 px-3 py-1.5 text-sm font-semibold ${active === x.topic ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface"}`}>
            <span>{topicInfo(x.topic, lang).icon}</span><span className="whitespace-nowrap">{topicInfo(x.topic, lang).label}</span><span className="text-xs opacity-70">{x.learned}/{x.count}</span>
          </button>
        ))}
      </nav>
      <aside className="hidden rounded-card border-2 border-border bg-surface p-4 shadow-raised lg:sticky lg:top-20 lg:block lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto" aria-label={t("Danh sách chủ đề")}>
        <h2 className="mb-3 px-1 text-sm font-bold uppercase tracking-wide text-primary-text">{t("DANH SÁCH CHỦ ĐỀ")}</h2>
        <ul className="space-y-3">
          {topics.map((x) => {
            const on = active === x.topic, open = !closed.has(x.topic), pct = x.count ? (x.learned / x.count) * 100 : 0;
            return (
              <li key={x.topic}>
                <div className={`flex items-center gap-3 rounded-card border-2 p-2.5 shadow-raised transition hover:-translate-y-0.5 ${on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface hover:border-primary/40"}`}>
                  <button onClick={() => onPick(x.topic)} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-current={on}>
                    <Tile topic={x.topic} />
                    <span className="min-w-0"><span className="block truncate text-sm font-bold">{topicInfo(x.topic, lang).label}</span>
                      <span className={`block text-xs ${on ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{t("{a}/{b} thẻ", { a: x.learned, b: x.count })}</span></span>
                  </button>
                  <button onClick={() => toggle(x.topic)} aria-expanded={open} aria-label={open ? t("Thu gọn") : t("Mở rộng")}
                    className={`flex h-7 w-9 shrink-0 items-center justify-center rounded-btn border-2 text-sm font-bold ${on ? "border-primary/40 bg-primary-hover text-primary-foreground" : "border-border bg-surface-secondary text-muted-foreground"}`}>{open ? "−" : "+"}</button>
                </div>
                {open && (
                  <div className="mx-2 mt-1.5 h-1.5 overflow-hidden rounded-full bg-border" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
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
