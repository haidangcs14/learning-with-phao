"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, ErrorBox, Page, Spinner } from "@/components/ui";
import { WordActions, useFavoriteIds } from "@/components/word-actions";
import { useGet } from "@/hooks/api";
import { useT } from "@/lib/i18n";
import { BackLink } from "@/components/back-link";
import { WordVisual } from "@/components/word-visual";
import { useLang } from "@/store/lang-store";
import type { Word } from "@/types";

export default function WordDetailPage() {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const { id } = useParams<{ id: string }>();
  const q = useGet<Word>(`/words/${id}`);
  const { ids } = useFavoriteIds();
  if (q.isLoading) return <Spinner />;
  if (q.error || !q.data) return <div className="p-6"><ErrorBox error={q.error} /></div>;
  const w = q.data.data;
  return (
    <Page title={w.word}>
      <BackLink href="/vocabulary">{t("← Danh sách từ")}</BackLink>
      <p className="text-lg text-slate-500">{w.phonetic} · {w.level}</p>
      <WordVisual word={w} size="lg" />
      <WordActions id={w.id} word={w.word} isFav={ids.has(w.id)} />
      {w.meanings.map((m, i) => (
        <Card key={i} className="space-y-1">
          <p className="text-sm font-semibold uppercase text-indigo-600">{m.part_of_speech}</p>
          <p>{m.definition}</p>
          {lang === "vi" && <><p className="font-medium">{m.translation_vi}</p>{m.definition_vi && <p className="text-sm text-slate-600 dark:text-slate-300">{m.definition_vi}</p>}</>}
          <ul className="list-disc pl-5 text-sm text-slate-500">{m.examples.map((e, k) => <li key={e}>{e}{lang === "vi" && m.examples_vi?.[k] ? <span className="block text-slate-400">{m.examples_vi[k]}</span> : null}</li>)}</ul>
        </Card>
      ))}
      {w.topics.length > 0 && <p className="text-sm">{t("Chủ đề:")} {w.topics.join(", ")}</p>}
    </Page>
  );
}
