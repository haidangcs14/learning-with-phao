"use client";

import Link from "next/link";
import { useState } from "react";
import { useConfirm } from "@/components/confirm";
import type { ExamSummary } from "@/components/exam/types";
import { Button, Card, ErrorBox, Page, Spinner } from "@/components/ui";
import { useGet, useSend } from "@/hooks/api";
import { useT } from "@/lib/i18n";

type Uploaded = ExamSummary & { warnings: string[] };

export default function AdminExams() {
  const t = useT();
  const ask = useConfirm();
  const [file, setFile] = useState<File | null>(null);
  const list = useGet<ExamSummary[]>("/exams/manage");
  const upload = useSend<Uploaded, FormData>("POST", "/exams/parse", ["/exams"]);
  const toggle = useSend<unknown, { id: string; status: "draft" | "published" }>("PUT", (v) => `/exams/${v.id}`, ["/exams"], (v) => ({ status: v.status }));
  const del = useSend<unknown, string>("DELETE", (id) => `/exams/${id}`, ["/exams"]);
  const done = upload.data?.data;

  function send() {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    upload.mutate(fd, { onSuccess: () => setFile(null) });
  }
  return (
    <Page title={t("Quản lý bài kiểm tra")}>
      <Card className="space-y-3">
        <p className="text-sm text-slate-500">{t("Tải lên đề thi (.docx hoặc .pdf, tối đa 15MB). Hệ thống tự nhận diện câu hỏi trắc nghiệm, điền chỗ trống, đoạn văn, phần nghe và đáp án. Sau đó bạn kiểm tra, chỉnh sửa và công khai cho học sinh.")}</p>
        <div className="flex flex-wrap items-center gap-2">
          <input type="file" accept=".docx,.pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <Button disabled={!file || upload.isPending} onClick={send}>{upload.isPending ? t("Đang đọc đề...") : t("Tải lên và đọc đề")}</Button>
        </div>
        {upload.error && <ErrorBox error={upload.error} />}
        {done && (
          <div className="space-y-2 rounded-lg bg-green-50 p-3 text-sm dark:bg-green-950/50">
            <p>✓ {t("Đã đọc đề: {title} ({n} câu hỏi).", { title: done.title, n: done.question_count })} <Link className="font-semibold text-indigo-600 underline" href={`/admin/exams/${done.id}`}>{t("Mở để kiểm tra và chỉnh sửa")}</Link></p>
            {done.warnings.length > 0 && <ul className="list-disc pl-5 text-amber-800 dark:text-amber-300">{done.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>}
          </div>
        )}
      </Card>
      {(toggle.error || del.error) && <ErrorBox error={toggle.error ?? del.error} />}
      {list.isLoading ? <Spinner /> : (list.data?.data.length ?? 0) === 0 ? <p className="p-4 text-center text-slate-500">{t("Chưa có bài kiểm tra nào.")}</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-slate-500"><tr><th className="p-2">{t("Tiêu đề")}</th><th>{t("Trạng thái")}</th><th>{t("Câu hỏi")}</th><th>{t("Thời gian")}</th><th>{t("Lượt làm")}</th><th></th></tr></thead>
            <tbody>
              {list.data?.data.map((e) => (
                <tr key={e.id} className="border-t border-slate-200 dark:border-slate-800">
                  <td className="p-2 font-medium">{e.title}{e.has_audio ? " 🎧" : ""}</td>
                  <td><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${e.status === "published" ? "bg-green-600 text-white" : "bg-slate-300 text-slate-800"}`}>{e.status === "published" ? t("Đã công khai") : t("Bản nháp")}</span></td>
                  <td>{e.question_count}</td><td>{t("{n} phút", { n: e.duration_minutes })}</td><td>{e.attempts ?? 0}</td>
                  <td className="space-x-2 whitespace-nowrap py-1 text-right">
                    <Link href={`/admin/exams/${e.id}`} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">{t("Chỉnh sửa")}</Link>
                    <Button variant="ghost" onClick={() => toggle.mutate({ id: e.id, status: e.status === "published" ? "draft" : "published" })}>{e.status === "published" ? t("Gỡ xuống") : t("Công khai")}</Button>
                    <Button variant="danger" onClick={async () => { if (await ask({ title: t("Xoá {name}?", { name: e.title }), message: t("Bài kiểm tra, âm thanh và mọi lượt làm bài của học sinh sẽ bị xoá."), confirmLabel: t("Xoá"), danger: true })) del.mutate(e.id); }}>{t("Xoá")}</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Page>
  );
}
