"use client";

import { useState } from "react";
import { Button, Card, Empty, ErrorBox, Page, Pager, Spinner, inputCls } from "@/components/ui";
import { useGet } from "@/hooks/api";
import { useT } from "@/lib/i18n";
import { useLang } from "@/store/lang-store";
import { qs, speak } from "@/lib/utils";

interface Sentence { id: string; english: string; vietnamese: string; topic: string; level: string }
const TOPICS = ["Greetings", "Travel", "Shopping", "Restaurant", "School", "Work", "Interview", "Daily Conversation"];

export default function SentencesPage() {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const [input, setInput] = useState("");
  const [q, setQ] = useState("");
  const [topic, setTopic] = useState("");
  const [page, setPage] = useState(1);
  const res = useGet<Sentence[]>(`/sentences?${qs({ q, topic, page, limit: 12 })}`);
  const rows = res.data?.data ?? [];
  return (
    <Page title={t("Mẫu câu giao tiếp")}>
      <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); setQ(input); setPage(1); }}>
        <input className={`${inputCls} sm:max-w-xs`} placeholder={t("Tìm mẫu câu...")} value={input} onChange={(e) => setInput(e.target.value)} />
        <select className={`${inputCls} w-auto`} value={topic} onChange={(e) => { setTopic(e.target.value); setPage(1); }}>
          <option value="">{t("Mọi chủ đề")}</option>
          {TOPICS.map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
        <Button type="submit">{t("Tìm")}</Button>
      </form>
      {res.isLoading ? <Spinner /> : res.error ? <ErrorBox error={res.error} /> : rows.length === 0 ? <Empty>{t("Không có mẫu câu nào.")}</Empty> : (
        <div className="grid gap-3 sm:grid-cols-2">
          {rows.map((s) => (
            <Card key={s.id} className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{s.english}</p>
                {lang === "vi" && <p className="text-sm text-slate-500 dark:text-slate-400">{s.vietnamese}</p>}
                <p className="mt-1 text-xs text-slate-400">{s.topic} · {s.level}</p>
              </div>
              <Button variant="ghost" onClick={() => speak(s.english)} aria-label={t("Nghe")}>🔊</Button>
            </Card>
          ))}
        </div>
      )}
      <Pager meta={res.data?.meta} onPage={setPage} />
    </Page>
  );
}
