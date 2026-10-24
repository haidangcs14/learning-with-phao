"use client";

import { useState } from "react";
import { useConfirm } from "@/components/confirm";
import { Button, Card, ErrorBox, Page, Pager, Spinner, inputCls } from "@/components/ui";
import { useGet, useSend } from "@/hooks/api";
import { useT } from "@/lib/i18n";
import { qs } from "@/lib/utils";
import type { Word } from "@/types";

const EMPTY = { word: "", phonetic: "", level: "A1", topic: "", part_of_speech: "noun", definition: "", translation_vi: "", example: "", definition_vi: "", example_vi: "", emoji: "", image_url: "" };

export default function AdminWords() {
  const t = useT();
  const ask = useConfirm();
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(EMPTY);
  const words = useGet<Word[]>(`/words?${qs({ page, limit: 10 })}`);
  const create = useSend<unknown, typeof EMPTY>("POST", "/words", ["/words"], (f) => ({
    word: f.word, phonetic: f.phonetic, level: f.level, topics: f.topic ? [f.topic] : [], emoji: f.emoji, image_url: f.image_url,
    meanings: [{ part_of_speech: f.part_of_speech, definition: f.definition, translation_vi: f.translation_vi, definition_vi: f.definition_vi, examples: f.example ? [f.example] : [], examples_vi: f.example_vi ? [f.example_vi] : [] }],
  }));
  const del = useSend<unknown, string>("DELETE", (id) => `/words/${id}`, ["/words"]);
  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });
  return (
    <Page title={t("Quản lý từ vựng")}>
      <Card>
        <form className="grid gap-2 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); create.mutate(form, { onSuccess: () => setForm(EMPTY) }); }}>
          <input required className={inputCls} placeholder={t("Từ (word)")} value={form.word} onChange={set("word")} />
          <input className={inputCls} placeholder={t("Phiên âm /.../")} value={form.phonetic} onChange={set("phonetic")} />
          <select className={inputCls} value={form.level} onChange={set("level")}>{["A1", "A2", "B1", "B2", "C1", "C2"].map((l) => <option key={l}>{l}</option>)}</select>
          <select className={inputCls} value={form.part_of_speech} onChange={set("part_of_speech")}>{["noun", "verb", "adjective", "adverb", "preposition", "other"].map((l) => <option key={l}>{l}</option>)}</select>
          <input required className={inputCls} placeholder={t("Định nghĩa (English)")} value={form.definition} onChange={set("definition")} />
          <input required className={inputCls} placeholder={t("Nghĩa tiếng Việt")} value={form.translation_vi} onChange={set("translation_vi")} />
          <input className={inputCls} placeholder={t("Ví dụ")} value={form.example} onChange={set("example")} />
          <input className={inputCls} placeholder={t("Chủ đề")} value={form.topic} onChange={set("topic")} />
          <input className={inputCls} placeholder={t("Định nghĩa tiếng Việt")} value={form.definition_vi} onChange={set("definition_vi")} />
          <input className={inputCls} placeholder={t("Ví dụ tiếng Việt")} value={form.example_vi} onChange={set("example_vi")} />
          <input className={inputCls} placeholder={t("Emoji minh họa")} maxLength={8} value={form.emoji} onChange={set("emoji")} />
          <input className={inputCls} type="url" placeholder={t("Link ảnh minh họa (https://...)")} value={form.image_url} onChange={set("image_url")} />
          <Button type="submit" disabled={create.isPending} className="sm:col-span-2">{t("Thêm từ")}</Button>
        </form>
        {create.error && <div className="mt-2"><ErrorBox error={create.error} /></div>}
      </Card>
      {del.error && <ErrorBox error={del.error} />}
      {words.isLoading ? <Spinner /> : (
        <ul className="divide-y divide-slate-200 dark:divide-slate-800">
          {words.data?.data.map((w) => (
            <li key={w.id} className="flex items-center justify-between py-2 text-sm">
              <span><b>{w.word}</b> {w.phonetic} · {w.level} · {w.meanings[0]?.translation_vi}</span>
              <Button variant="danger" onClick={async () => { if (await ask({ title: t("Xoá {name}?", { name: w.word }), confirmLabel: t("Xoá"), danger: true })) del.mutate(w.id); }}>{t("Xoá")}</Button>
            </li>
          ))}
        </ul>
      )}
      <Pager meta={words.data?.meta} onPage={setPage} />
    </Page>
  );
}
