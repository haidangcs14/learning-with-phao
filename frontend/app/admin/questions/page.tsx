"use client";

import { useState } from "react";
import { useConfirm } from "@/components/confirm";
import { Button, Card, ErrorBox, Page, Pager, Spinner } from "@/components/ui";
import { useGet, useSend } from "@/hooks/api";
import { useT } from "@/lib/i18n";

interface Preview { import_id: string | null; valid_count: number; error_count: number; errors: { row: number; error: string }[]; preview: { question: string; level: string; correct_answer: string }[] }
interface Q { id: string; question: string; level: string; topic: string; correct_answer: string }

export default function AdminQuestions() {
  const t = useT();
  const ask = useConfirm();
  const [page, setPage] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [prev, setPrev] = useState<Preview | null>(null);
  const list = useGet<Q[]>(`/admin/questions?page=${page}&limit=10`);
  const preview = useSend<Preview, FormData>("POST", "/admin/questions/import/preview");
  const confirmImport = useSend<{ inserted: number }, { import_id: string }>("POST", "/admin/questions/import/confirm", ["/admin/questions", "/admin/stats"]);
  const del = useSend<unknown, string>("DELETE", (id) => `/admin/questions/${id}`, ["/admin/questions"]);

  function upload() {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    preview.mutate(fd, { onSuccess: (r) => setPrev(r.data) });
  }
  return (
    <Page title={t("Câu hỏi quiz")}>
      <Card className="space-y-3">
        <p className="text-sm text-slate-500">{t("Tải lên CSV / JSON / XLSX (tối đa 2MB). Cột CSV: question, type, level, topic, option_a..option_d, answer (A-D). Dữ liệu chỉ được ghi sau khi bạn xác nhận.")}</p>
        <div className="flex flex-wrap items-center gap-2">
          <input type="file" accept=".csv,.json,.xlsx" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setPrev(null); }} />
          <Button disabled={!file || preview.isPending} onClick={upload}>{t("Xem trước")}</Button>
        </div>
        {preview.error && <ErrorBox error={preview.error} />}
        {prev && (
          <div className="space-y-2 text-sm">
            <p>{t("Hợp lệ: {v} · Lỗi: {e}", { v: prev.valid_count, e: prev.error_count })}</p>
            {prev.errors.map((e) => <p key={e.row} className="text-red-600">{t("Dòng {r}: {msg}", { r: e.row, msg: e.error })}</p>)}
            <ul className="list-disc pl-5">{prev.preview.map((p, i) => <li key={i}>[{p.level}] {p.question} → {p.correct_answer}</li>)}</ul>
            {prev.import_id && (
              <Button disabled={confirmImport.isPending} onClick={() => confirmImport.mutate({ import_id: prev.import_id as string }, { onSuccess: () => { setPrev(null); setFile(null); } })}>
                {t("Xác nhận nhập {n} câu", { n: prev.valid_count })}
              </Button>
            )}
          </div>
        )}
        {confirmImport.isSuccess && <p className="text-green-600">{t("Đã nhập {n} câu hỏi.", { n: confirmImport.data.data.inserted })}</p>}
        {confirmImport.error && <ErrorBox error={confirmImport.error} />}
      </Card>
      {del.error && <ErrorBox error={del.error} />}
      {list.isLoading ? <Spinner /> : (
        <ul className="divide-y divide-slate-200 dark:divide-slate-800">
          {list.data?.data.map((q) => (
            <li key={q.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span>[{q.level}] {q.question} → <b>{q.correct_answer}</b></span>
              <Button variant="danger" onClick={async () => { if (await ask({ title: t("Xoá câu hỏi?"), message: q.question, confirmLabel: t("Xoá"), danger: true })) del.mutate(q.id); }}>{t("Xoá")}</Button>
            </li>
          ))}
        </ul>
      )}
      <Pager meta={list.data?.meta} onPage={setPage} />
    </Page>
  );
}
