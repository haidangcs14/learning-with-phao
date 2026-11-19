"use client";

import { useState } from "react";
import { Dialog } from "@/components/dialog";
import { Button, ErrorBox, inputCls } from "@/components/ui";
import { POS_CHOICES, type SetCard, type SetGroup } from "@/components/vocab/types";
import { useGet } from "@/hooks/api";
import { useT } from "@/lib/i18n";
import type { Word } from "@/types";

export interface CardValues { word: string; phonetic: string; translation: string; pos: string; definition_en: string; definition_vi: string; example_en: string; example_vi: string }
const EMPTY: CardValues = { word: "", phonetic: "", translation: "", pos: "", definition_en: "", definition_vi: "", example_en: "", example_vi: "" };
const label = "mb-1 block text-xs font-bold uppercase tracking-wide text-muted-foreground";

/** Create or edit one card: word, IPA, translation, part of speech, definitions and examples (English / Vietnamese).
 *  The search box above can pre-fill everything from the built-in dictionary. */
export function CardDialog({ card, groups, groupId, saving, error, onSave, onClose }: {
  card?: SetCard; groups: SetGroup[]; groupId: string; saving: boolean; error: unknown; onSave: (values: CardValues, groupId: string) => void; onClose: () => void;
}) {
  const t = useT();
  const [v, setV] = useState<CardValues>(card ? { word: card.word, phonetic: card.phonetic, translation: card.translation, pos: card.pos, definition_en: card.definition_en, definition_vi: card.definition_vi, example_en: card.example_en, example_vi: card.example_vi } : EMPTY);
  const [group, setGroup] = useState(groupId);
  const [tried, setTried] = useState(false);
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const found = useGet<Word[]>(query ? `/words?q=${encodeURIComponent(query)}&limit=6` : null);
  const set = (k: keyof CardValues) => (e: { target: { value: string } }) => setV((x) => ({ ...x, [k]: e.target.value }));
  const bad = { word: !v.word.trim(), translation: !v.translation.trim() };

  function fill(w: Word) {
    const m = w.meanings[0];
    setV({ word: w.word, phonetic: w.phonetic ?? "", translation: m?.translation_vi ?? "", pos: POS_CHOICES.some(([k]) => k === m?.part_of_speech) ? (m?.part_of_speech ?? "") : "",
      definition_en: m?.definition ?? "", definition_vi: m?.definition_vi ?? "", example_en: m?.examples?.[0] ?? "", example_vi: m?.examples_vi?.[0] ?? "" });
    setQuery(""); setQ("");
  }
  function save() {
    setTried(true);
    if (bad.word || bad.translation) return;
    onSave({ ...v, word: v.word.trim(), translation: v.translation.trim() }, group);
  }
  const enter = (e: React.KeyboardEvent) => { if (e.key === "Enter") { e.preventDefault(); save(); } };

  return (
    <Dialog open wide title={card ? t("Sửa thẻ") : t("Tạo Thẻ")} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-center text-sm text-muted-foreground">{card ? t("Chỉnh sửa nội dung thẻ.") : t("Thêm từ vựng mới vào nhóm này")}</p>

        <div className="rounded-card border border-border bg-primary-soft/40 p-3">
          <p className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wide">🔍 {t("Tìm từ vựng")}</p>
          <div className="flex gap-2">
            <input data-autofocus className={inputCls} value={q} placeholder={t("Nhập từ cần tìm...")} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); setQuery(q.trim()); } }} aria-label={t("Tìm từ vựng")} />
            <Button variant="ghost" onClick={() => setQuery(q.trim())} aria-label={t("Tìm")}>🔍</Button>
          </div>
          {query && (found.isLoading ? <p className="mt-2 text-sm text-muted-foreground">{t("Đang tải...")}</p>
            : (found.data?.data ?? []).length === 0 ? <p className="mt-2 text-sm text-muted-foreground">{t("Không tìm thấy từ nào. Bạn có thể tự nhập bên dưới.")}</p>
            : <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">{(found.data?.data ?? []).map((w) => (
                <li key={w.id}><button onClick={() => fill(w)} className="w-full rounded-btn border border-border bg-surface px-3 py-2 text-left text-sm hover:border-primary hover:bg-primary-soft">
                  <b>{w.word}</b> <span className="text-xs text-muted-foreground">{w.phonetic}</span><span className="block text-muted-foreground [overflow-wrap:anywhere]">{w.meanings[0]?.translation_vi}</span></button></li>
              ))}</ul>)}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className={label} htmlFor="cd-word">{t("Từ vựng")} <span className="text-error-text">*</span></label>
            <input id="cd-word" className={inputCls} value={v.word} maxLength={60} placeholder={t("Nhập từ vựng")} aria-invalid={tried && bad.word} onChange={set("word")} onKeyDown={enter} />
            {tried && bad.word && <p className="mt-1 text-xs text-error-text">{t("Vui lòng nhập từ vựng.")}</p>}</div>
          <div><label className={label} htmlFor="cd-ipa">{t("Phiên âm IPA (tùy chọn)")}</label>
            <input id="cd-ipa" className={inputCls} value={v.phonetic} maxLength={60} placeholder="VD: /həˈloʊ/" onChange={set("phonetic")} onKeyDown={enter} /></div>
        </div>
        <div><label className={label} htmlFor="cd-tr">{t("Bản dịch")} <span className="text-error-text">*</span></label>
          <input id="cd-tr" className={inputCls} value={v.translation} maxLength={200} placeholder={t("Nhập bản dịch")} aria-invalid={tried && bad.translation} onChange={set("translation")} onKeyDown={enter} />
          {tried && bad.translation && <p className="mt-1 text-xs text-error-text">{t("Vui lòng nhập bản dịch.")}</p>}</div>

        <div><span className={label}>{t("Loại từ (tùy chọn)")}</span>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("Loại từ (tùy chọn)")}>
            {POS_CHOICES.map(([k, name]) => (
              <button key={k} role="radio" aria-checked={v.pos === k} onClick={() => setV((x) => ({ ...x, pos: x.pos === k ? "" : k }))}
                className={`rounded-full border-2 px-3.5 py-1 text-sm font-semibold transition ${v.pos === k ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface hover:border-primary/60 hover:bg-primary-soft"}`}>{t(name)}</button>
            ))}
          </div></div>

        <div><span className={label}>{t("Định nghĩa (tùy chọn)")}</span>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-muted-foreground">English:<textarea className={`${inputCls} mt-1 min-h-24 resize-y text-base`} maxLength={400} value={v.definition_en} placeholder={t("Nhập định nghĩa (tùy chọn)")} onChange={set("definition_en")} /></label>
            <label className="text-xs text-muted-foreground">Tiếng Việt:<textarea className={`${inputCls} mt-1 min-h-24 resize-y text-base`} maxLength={400} value={v.definition_vi} placeholder={t("Nhập định nghĩa (tùy chọn)")} onChange={set("definition_vi")} /></label>
          </div></div>
        <div><span className={label}>{t("Ví dụ (tùy chọn)")}</span>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-muted-foreground">English:<textarea className={`${inputCls} mt-1 min-h-24 resize-y text-base`} maxLength={300} value={v.example_en} placeholder={t("Nhập ví dụ (tùy chọn)")} onChange={set("example_en")} /></label>
            <label className="text-xs text-muted-foreground">Tiếng Việt:<textarea className={`${inputCls} mt-1 min-h-24 resize-y text-base`} maxLength={300} value={v.example_vi} placeholder={t("Nhập ví dụ (tùy chọn)")} onChange={set("example_vi")} /></label>
          </div></div>

        {card && groups.length > 1 && (
          <div><label className={label} htmlFor="cd-group">{t("Nhóm")}</label>
            <select id="cd-group" className={inputCls} value={group} onChange={(e) => setGroup(e.target.value)}>{groups.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}</select></div>
        )}
        {error != null && <ErrorBox error={error} />}
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>{t("Hủy")}</Button><Button onClick={save} disabled={saving}>{card ? t("Lưu") : t("Tạo")}</Button></div>
      </div>
    </Dialog>
  );
}
