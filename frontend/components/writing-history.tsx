"use client";

import { useEffect, useState } from "react";
import { useConfirm } from "@/components/confirm";
import { WritingEvaluation, type WritingEval } from "@/components/writing-evaluation";
import { Button, Card, Empty, ErrorBox, Pager, Spinner } from "@/components/ui";
import { useGet, useSend } from "@/hooks/api";
import { useT } from "@/lib/i18n";
import { useLang } from "@/store/lang-store";

export interface Submission { id: string; title: string; level: string; instruction: string; text: string; word_count: number; overall: number; created_at: string; evaluation: WritingEval; xp_awarded?: number }

function DetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const ask = useConfirm();
  const q = useGet<Submission>(`/writing/submissions/${id}`);
  const del = useSend<unknown, string>("DELETE", (x) => `/writing/submissions/${x}`, ["/writing/submissions"]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const s = q.data?.data;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}
        className="animate-modal max-h-[90vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-t-2xl bg-white p-5 text-slate-900 shadow-2xl sm:rounded-2xl dark:bg-slate-900 dark:text-slate-100">
        {q.isLoading ? <Spinner /> : !s ? <ErrorBox error={q.error} /> : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div><p className="text-lg font-semibold">{s.title || t("Viết tự do")}</p><p className="text-sm text-slate-500">{new Date(s.created_at).toLocaleString(lang === "en" ? "en-US" : "vi-VN")}</p></div>
              <button onClick={onClose} aria-label={t("Đóng")} className="rounded px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800">✕</button>
            </div>
            {s.instruction && <p className="text-sm italic text-slate-600 dark:text-slate-300">“{s.instruction}”</p>}
            <div><p className="mb-1 text-sm font-semibold">{t("Bài viết của bạn")}</p><p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800/60">{s.text}</p></div>
            <WritingEvaluation ev={s.evaluation} />
            {del.error && <ErrorBox error={del.error} />}
            <div className="flex justify-end">
              <Button variant="danger" disabled={del.isPending}
                onClick={async () => { if (await ask({ title: t("Xoá bài viết này?"), message: t("Bài viết và kết quả chấm sẽ bị xoá vĩnh viễn."), confirmLabel: t("Xoá"), danger: true })) del.mutate(s.id, { onSuccess: onClose }); }}>{t("Xoá")}</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function WritingHistory() {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const q = useGet<Submission[]>(`/writing/submissions?page=${page}&limit=6`);
  const rows = q.data?.data ?? [];
  if (q.isLoading) return <Spinner />;
  if (q.error) return <ErrorBox error={q.error} />;
  if (rows.length === 0 && page === 1) return <Empty>{t("Chưa có bài viết nào.")}</Empty>;
  return (
    <>
      <div className="space-y-2">
        {rows.map((s) => (
          <button key={s.id} onClick={() => setOpen(s.id)} className="w-full text-left">
            <Card className="flex items-center justify-between gap-3 text-sm transition hover:border-indigo-500">
              <span><span className="font-medium">{s.title || t("Viết tự do")}</span>
                <span className="block text-xs text-slate-500">{new Date(s.created_at).toLocaleString(lang === "en" ? "en-US" : "vi-VN")} · {t("{n} từ", { n: s.word_count })}</span></span>
              <span className="shrink-0 rounded-full bg-indigo-600 px-3 py-1 font-bold text-white">{s.overall}</span>
            </Card>
          </button>
        ))}
      </div>
      <Pager meta={q.data?.meta} onPage={setPage} />
      {open && <DetailModal id={open} onClose={() => setOpen(null)} />}
    </>
  );
}
