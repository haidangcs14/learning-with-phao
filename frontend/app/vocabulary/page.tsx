"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, Card, Empty, ErrorBox, Page, Pager, Spinner, Tabs, inputCls } from "@/components/ui";
import { WordActions, useFavoriteIds } from "@/components/word-actions";
import { useGet, useSend } from "@/hooks/api";
import { useT } from "@/lib/i18n";
import { topicInfo } from "@/lib/topics";
import { qs } from "@/lib/utils";
import { useAuth } from "@/store/auth-store";
import { useLang } from "@/store/lang-store";
import type { Word } from "@/types";

const LEVELS = ["", "A1", "A2", "B1", "B2", "C1", "C2"];
interface TopicCount { topic: string; count: number }

export default function VocabularyPage() {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const user = useAuth((s) => s.user);
  const [input, setInput] = useState("");
  const [q, setQ] = useState("");
  const [level, setLevel] = useState("");
  const [topic, setTopic] = useState("");
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<"all" | "fav">("all");
  const topics = useGet<TopicCount[]>(tab === "all" ? `/words/topics${level ? `?level=${level}` : ""}` : null);
  const words = useGet<Word[]>(tab === "all" ? `/words?${qs({ q, level, topic, page, limit: 24 })}` : null);
  const { favs, ids } = useFavoriteIds();
  const addTopic = useSend<{ added: number }, { topic: string }>("POST", "/flashcards/topic", ["/flashcards"]);

  const list: Word[] = tab === "all"
    ? words.data?.data ?? []
    : favs.data?.data.map((f) => f.item).filter((w): w is Word => !!w) ?? [];
  const loading = tab === "all" ? words.isLoading : favs.isLoading;
  const error = tab === "all" ? words.error : favs.error;
  const total = topics.data?.data.reduce((s, x) => s + x.count, 0) ?? 0;
  const pick = (name: string) => { setTopic(name); setPage(1); addTopic.reset(); };
  const current = topic ? topicInfo(topic, lang) : null;
  const cardCls = (active: boolean) => `flex items-center gap-2 rounded-xl border p-3 text-left text-sm transition ${active ? "border-indigo-600 bg-indigo-50 font-semibold dark:bg-indigo-950" : "border-slate-200 bg-white hover:border-indigo-400 dark:border-slate-800 dark:bg-slate-900/60"}`;

  return (
    <Page title={t("Từ vựng")}>
      {user && <Tabs value={tab} onChange={setTab} options={[["all", t("Tất cả")], ["fav", t("Yêu thích")]] as const} />}
      {tab === "all" && (
        <>
          <section aria-label={t("Chủ đề")}>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">{t("Chọn chủ đề")}</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              <button onClick={() => pick("")} className={cardCls(topic === "")}><span className="text-xl">📚</span><span>{t("Tất cả chủ đề")}<span className="block text-xs font-normal text-slate-500">{t("{n} từ", { n: total })}</span></span></button>
              {topics.data?.data.map((x) => {
                const info = topicInfo(x.topic, lang);
                return (
                  <button key={x.topic} onClick={() => pick(x.topic)} className={cardCls(topic === x.topic)}>
                    <span className="text-xl">{info.icon}</span>
                    <span className="min-w-0"><span className="block truncate">{info.label}</span><span className="block text-xs font-normal text-slate-500">{t("{n} từ", { n: x.count })}</span></span>
                  </button>
                );
              })}
            </div>
          </section>
          <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); setQ(input); setPage(1); }}>
            <input className={`${inputCls} sm:max-w-xs`} placeholder={t("Tìm từ...")} value={input} onChange={(e) => setInput(e.target.value)} />
            <select className={`${inputCls} w-auto`} value={level} onChange={(e) => { setLevel(e.target.value); setPage(1); }}>
              {LEVELS.map((l) => <option key={l} value={l}>{l || t("Mọi cấp độ")}</option>)}
            </select>
            <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white">{t("Tìm")}</button>
          </form>
          {current && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-indigo-50 p-3 dark:bg-indigo-950/40">
              <p className="font-semibold">{current.icon} {current.label}</p>
              {user && (
                <span className="flex items-center gap-2">
                  {addTopic.isSuccess && <span className="text-sm text-green-700 dark:text-green-400">✓ {t("Đã thêm {n} từ vào flashcard", { n: addTopic.data.data.added })}</span>}
                  <Button variant="ghost" disabled={addTopic.isPending} onClick={() => addTopic.mutate({ topic })}>{t("+ Thêm cả chủ đề vào Flashcard")}</Button>
                </span>
              )}
            </div>
          )}
        </>
      )}
      {loading ? <Spinner /> : error ? <ErrorBox error={error} /> : list.length === 0 ? <Empty>{t("Không có từ nào.")}</Empty> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((w) => (
            <Card key={w.id} className="space-y-2">
              <div className="flex items-start justify-between">
                <Link href={`/vocabulary/${w.id}`} className="text-lg font-semibold hover:text-indigo-600">{w.word}</Link>
                <span className="rounded bg-indigo-100 px-2 py-0.5 text-xs text-indigo-800">{w.level}</span>
              </div>
              <p className="text-sm text-slate-500">{w.phonetic}</p>
              <p className="text-sm">{lang === "en" ? w.meanings[0]?.definition : w.meanings[0]?.translation_vi} <span className="text-slate-400">({w.meanings[0]?.part_of_speech})</span></p>
              <WordActions id={w.id} word={w.word} isFav={ids.has(w.id)} />
            </Card>
          ))}
        </div>
      )}
      {tab === "all" && <Pager meta={words.data?.meta} onPage={setPage} />}
    </Page>
  );
}
