"use client";

import Link from "next/link";
import { useState } from "react";
import { useConfirm } from "@/components/confirm";
import { Button, Card, ErrorBox, Page, Spinner } from "@/components/ui";
import { LessonForm } from "@/components/video/lesson-form";
import { useGet, useSend } from "@/hooks/api";
import { useT } from "@/lib/i18n";

interface Lesson { id: string; title: string; level: string; category: string; visibility: string; owner_name: string; sentence_count: number; open_reports: number }
interface Report { id: string; lesson_id: string; lesson_title: string; no: number; reason: string; note: string; reporter_name: string; created_at: string }
const REASON: Record<string, string> = { wrong_text: "Sai nội dung", wrong_time: "Sai thời gian", other: "Lỗi khác" };

export default function AdminVideos() {
  const t = useT();
  const ask = useConfirm();
  const [adding, setAdding] = useState(false);
  const lessons = useGet<Lesson[]>("/video-lessons/admin/all");
  const reports = useGet<Report[]>("/video-lessons/admin/reports?status=open");
  const del = useSend<unknown, string>("DELETE", (id) => `/video-lessons/${id}`, ["/video-lessons"]);
  const resolve = useSend<unknown, string>("POST", (id) => `/video-lessons/admin/reports/${id}/resolve`, ["/video-lessons"]);
  return (
    <Page title={t("Quản lý video bài nghe")}>
      <div><Button onClick={() => setAdding(!adding)}>{adding ? t("Đóng") : t("+ Thêm bài công khai")}</Button></div>
      {adding && <LessonForm redirect={false} onCreated={() => setAdding(false)} />}
      {(del.error || resolve.error) && <ErrorBox error={del.error ?? resolve.error} />}

      <Card className="space-y-2">
        <h2 className="font-semibold">{t("Báo lỗi đang chờ xử lý")} ({reports.data?.data.length ?? 0})</h2>
        {reports.isLoading ? <Spinner /> : (reports.data?.data.length ?? 0) === 0 ? <p className="text-sm text-slate-500">{t("Không có báo lỗi nào.")}</p> : (
          <ul className="space-y-2 text-sm">
            {reports.data?.data.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 p-2 dark:border-slate-700">
                <span className="flex-1"><b>{r.lesson_title}</b> · #{r.no} · <span className="rounded bg-amber-100 px-1.5 text-amber-900">{t(REASON[r.reason] ?? r.reason)}</span> · {r.reporter_name}
                  {r.note && <span className="block text-slate-500">“{r.note}”</span>}</span>
                <Link href={`/listening/video/${r.lesson_id}`} className="text-indigo-600 underline">{t("Mở bài")}</Link>
                <Button variant="ghost" disabled={resolve.isPending} onClick={() => resolve.mutate(r.id)}>{t("Đã xử lý")}</Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {lessons.isLoading ? <Spinner /> : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-slate-500"><tr><th className="p-2">{t("Tiêu đề")}</th><th>{t("Trình độ")}</th><th>{t("Danh mục")}</th><th>{t("Chủ bài")}</th><th>{t("Hiển thị")}</th><th>{t("Câu")}</th><th>{t("Báo lỗi")}</th><th></th></tr></thead>
            <tbody>
              {lessons.data?.data.map((l) => (
                <tr key={l.id} className="border-t border-slate-200 dark:border-slate-800">
                  <td className="p-2 font-medium"><Link href={`/listening/video/${l.id}`} className="hover:text-indigo-600">{l.title}</Link></td>
                  <td>{l.level}</td><td>{l.category}</td><td>{l.owner_name}</td>
                  <td>{l.visibility === "public" ? t("Công khai") : t("Riêng tư")}</td><td>{l.sentence_count}</td>
                  <td>{l.open_reports > 0 ? <b className="text-amber-600">{l.open_reports}</b> : 0}</td>
                  <td><Button variant="danger" onClick={async () => { if (await ask({ title: t("Xoá {name}?", { name: l.title }), message: t("Bài nghe và tiến độ của mọi người dùng sẽ bị xoá."), confirmLabel: t("Xoá"), danger: true })) del.mutate(l.id); }}>{t("Xoá")}</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Page>
  );
}
