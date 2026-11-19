"use client";

import { useEffect, useState } from "react";
import { Roadmap, STAGES } from "@/components/grammar-roadmap";
import { Empty, ErrorBox, Page, Spinner } from "@/components/ui";
import { useGet } from "@/hooks/api";
import { useT } from "@/lib/i18n";

interface Lesson { id: string; title: string; slug: string; level: string; description: string; group?: string; en?: { description?: string } }

const VISITED_KEY = "grammar.visited";
// Vietnamese text is the translation key (English in lib/i18n.ts).
const TIPS = [
  "Đọc tên thì từ phải sang trái để suy ra công thức.",
  "Tiếp diễn (continuous) → động từ to be + V-ing.",
  "Hoàn thành (perfect) → have/has/had + V3 (to be → been).",
  "Tương lai → thêm will phía trước. Ví dụ: tương lai hoàn thành tiếp diễn = will have been + V-ing.",
  "Thì hiện tại dùng V1, thì quá khứ dùng V2, thì tương lai luôn có will.",
];

export default function GrammarPage() {
  const t = useT();
  const q = useGet<Lesson[]>("/grammar?limit=100");
  const [visited, setVisited] = useState<Set<string>>(new Set());
  useEffect(() => { try { setVisited(new Set(JSON.parse(localStorage.getItem(VISITED_KEY) ?? "[]") as string[])); } catch { /* ignore */ } }, []);
  const items = q.data?.data ?? [];
  const path = STAGES.flatMap((stage, si) => items.filter((l) => (l.group ?? "other") === stage.key).map((l) => ({ l, stage: si })));
  const done = path.filter((x) => visited.has(x.l.slug)).length;
  const next = path.findIndex((x) => !visited.has(x.l.slug));
  const pct = path.length ? Math.round((done / path.length) * 100) : 0;

  return (
    <Page title={t("Ngữ pháp")}>
      <details className="rounded-card border border-border bg-surface p-4 shadow-soft">
        <summary className="cursor-pointer font-semibold">💡 {t("Mẹo nhớ công thức 12 thì")}</summary>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">{TIPS.map((x) => <li key={x}>{t(x)}</li>)}</ol>
      </details>
      {q.isLoading ? <Spinner /> : q.error ? <ErrorBox error={q.error} /> : path.length === 0 ? <Empty>{t("Chưa có bài ngữ pháp.")}</Empty> : (
        <>
          <div className="rounded-card border border-border bg-surface p-4 shadow-soft">
            <div className="flex items-center justify-between text-sm font-semibold"><span>🗺️ {t("Đã xem {a}/{b} bài", { a: done, b: path.length })}</span><span>{pct}%</span></div>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-border" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} /></div>
          </div>

          <Roadmap steps={path} visited={visited} next={next} />
        </>
      )}
    </Page>
  );
}
