"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, ErrorBox, Page, Spinner } from "@/components/ui";
import { WordActions, useFavoriteIds } from "@/components/word-actions";
import { useGet } from "@/hooks/api";
import { useT } from "@/lib/i18n";
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
      <Link href="/vocabulary" className="text-sm text-indigo-600">{t("← Danh sách từ")}</Link>
      <p className="text-lg text-slate-500">{w.phonetic} · {w.level}</p>
      <WordActions id={w.id} word={w.word} isFav={ids.has(w.id)} />
      {w.meanings.map((m, i) => (
        <Card key={i} className="space-y-1">
          <p className="text-sm font-semibold uppercase text-indigo-600">{m.part_of_speech}</p>
          <p>{m.definition}</p>
          {lang === "vi" && <p className="font-medium">{m.translation_vi}</p>}
          <ul className="list-disc pl-5 text-sm text-slate-500">{m.examples.map((e) => <li key={e}>{e}</li>)}</ul>
        </Card>
      ))}
      {w.topics.length > 0 && <p className="text-sm">{t("Chủ đề:")} {w.topics.join(", ")}</p>}
    </Page>
  );
}
