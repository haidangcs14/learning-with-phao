"use client";

import Link from "next/link";
import { useState } from "react";
import { Card, Empty, ErrorBox, Page, Pager, Spinner, Tabs, inputCls } from "@/components/ui";
import { WordActions, useFavoriteIds } from "@/components/word-actions";
import { useGet } from "@/hooks/api";
import { useT } from "@/lib/i18n";
import { qs } from "@/lib/utils";
import { useAuth } from "@/store/auth-store";
import { useLang } from "@/store/lang-store";
import type { Word } from "@/types";

const LEVELS = ["", "A1", "A2", "B1", "B2", "C1", "C2"];

export default function VocabularyPage() {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const user = useAuth((s) => s.user);
  const [input, setInput] = useState("");
  const [q, setQ] = useState("");
  const [level, setLevel] = useState("");
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<"all" | "fav">("all");
  const words = useGet<Word[]>(tab === "all" ? `/words?${qs({ q, level, page, limit: 12 })}` : null);
  const { favs, ids } = useFavoriteIds();

  const list: Word[] = tab === "all"
    ? words.data?.data ?? []
    : favs.data?.data.map((f) => f.item).filter((w): w is Word => !!w) ?? [];
  const loading = tab === "all" ? words.isLoading : favs.isLoading;
  const error = tab === "all" ? words.error : favs.error;

  return (
    <Page title={t("Từ vựng")}>
      {user && <Tabs value={tab} onChange={setTab} options={[["all", t("Tất cả")], ["fav", t("Yêu thích")]] as const} />}
      {tab === "all" && (
        <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); setQ(input); setPage(1); }}>
          <input className={`${inputCls} sm:max-w-xs`} placeholder={t("Tìm từ...")} value={input} onChange={(e) => setInput(e.target.value)} />
          <select className={`${inputCls} w-auto`} value={level} onChange={(e) => { setLevel(e.target.value); setPage(1); }}>
            {LEVELS.map((l) => <option key={l} value={l}>{l || t("Mọi cấp độ")}</option>)}
          </select>
          <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white">{t("Tìm")}</button>
        </form>
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
