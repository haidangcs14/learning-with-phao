"use client";

import { useState } from "react";
import { Button, Card, ErrorBox } from "@/components/ui";
import { useSend } from "@/hooks/api";
import { apiBlob } from "@/lib/api";
import { useT } from "@/lib/i18n";

interface Preview {
  import_id: string | null; valid_count: number; error_count: number; new_count: number; update_count: number;
  errors: { row: number; error: string }[]; preview: { word: string; level: string; topics: string[]; emoji: string; meanings: { translation_vi: string }[] }[];
}

export function WordImport() {
  const t = useT();
  const [file, setFile] = useState<File | null>(null);
  const [prev, setPrev] = useState<Preview | null>(null);
  const preview = useSend<Preview, FormData>("POST", "/admin/words/import/preview");
  const confirm = useSend<{ inserted: number; updated: number }, { import_id: string }>("POST", "/admin/words/import/confirm", ["/words", "/admin"]);

  async function template() {
    const blob = await apiBlob("/admin/words/import/template");
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "words-template.csv" });
    a.click();
    URL.revokeObjectURL(a.href);
  }
  return (
    <Card className="space-y-3">
      <h2 className="font-semibold">{t("Nhập từ vựng từ file")}</h2>
      <p className="text-sm text-slate-500">{t("Tải lên CSV / JSON / XLSX (tối đa 2MB, 2000 dòng). Cột: word, phonetic, part_of_speech, definition, definition_vi, translation_vi, example, example_vi, level, topic, emoji, image_url. Từ đã có sẽ được cập nhật. Dữ liệu chỉ được ghi sau khi bạn xác nhận.")}</p>
      <div className="flex flex-wrap items-center gap-2">
        <input type="file" accept=".csv,.json,.xlsx" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setPrev(null); confirm.reset(); }} />
        <Button disabled={!file || preview.isPending} onClick={() => { if (!file) return; const fd = new FormData(); fd.append("file", file); preview.mutate(fd, { onSuccess: (r) => setPrev(r.data) }); }}>{t("Xem trước")}</Button>
        <Button variant="ghost" onClick={() => void template()}>{t("Tải file mẫu")}</Button>
      </div>
      {preview.error && <ErrorBox error={preview.error} />}
      {prev && (
        <div className="space-y-2 text-sm">
          <p>{t("Hợp lệ: {v} · Lỗi: {e}", { v: prev.valid_count, e: prev.error_count })} · {t("Từ mới: {n}", { n: prev.new_count })} · {t("Cập nhật: {n}", { n: prev.update_count })}</p>
          {prev.errors.map((e) => <p key={e.row} className="text-red-600">{t("Dòng {r}: {msg}", { r: e.row, msg: e.error })}</p>)}
          {prev.preview.length > 0 && (
            <ul className="grid gap-1 sm:grid-cols-2">{prev.preview.map((w) => (
              <li key={w.word} className="rounded border border-slate-200 px-2 py-1 dark:border-slate-700">{w.emoji} <b>{w.word}</b> · {w.level} · {w.meanings[0]?.translation_vi} <span className="text-xs text-slate-500">({w.topics.join(", ")})</span></li>))}</ul>
          )}
          {prev.import_id && (
            <Button disabled={confirm.isPending} onClick={() => confirm.mutate({ import_id: prev.import_id as string }, { onSuccess: () => { setPrev(null); setFile(null); } })}>{t("Xác nhận nhập {n} từ", { n: prev.valid_count })}</Button>
          )}
        </div>
      )}
      {confirm.isSuccess && <p className="text-sm text-green-600">✓ {t("Đã thêm {a} từ mới, cập nhật {b} từ.", { a: confirm.data.data.inserted, b: confirm.data.data.updated })}</p>}
      {confirm.error && <ErrorBox error={confirm.error} />}
    </Card>
  );
}
