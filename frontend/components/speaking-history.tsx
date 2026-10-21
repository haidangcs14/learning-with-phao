"use client";

import { useEffect, useState } from "react";
import { useConfirm } from "@/components/confirm";
import { SpeakingEvaluation } from "@/components/speaking-evaluation";
import { Button, Card, Empty, ErrorBox, Pager, Spinner } from "@/components/ui";
import { useGet, useSend } from "@/hooks/api";
import { apiBlob } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { useLang } from "@/store/lang-store";
import type { SpeakingSession } from "@/types";

function SessionModal({ s, onClose }: { s: SpeakingSession; onClose: () => void }) {
  const t = useT();
  const lang = useLang((x) => x.lang);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioError, setAudioError] = useState(false);
  const del = useSend<unknown, string>("DELETE", (id) => `/speaking/sessions/${id}`, ["/speaking/sessions"]);
  const ask = useConfirm();

  useEffect(() => { // the audio endpoint needs the Authorization header, so we download it as a blob
    let url: string | null = null;
    let cancelled = false;
    setAudioUrl(null); setAudioError(false);
    apiBlob(`/speaking/sessions/${s.id}/audio`)
      .then((b) => { if (!cancelled) { url = URL.createObjectURL(b); setAudioUrl(url); } })
      .catch(() => { if (!cancelled) setAudioError(true); });
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [s.id]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}
        className="animate-modal max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-t-2xl bg-white p-5 text-slate-900 shadow-2xl sm:rounded-2xl dark:bg-slate-900 dark:text-slate-100">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-semibold">{s.topic_title}</p>
            <p className="text-sm text-slate-500">{new Date(s.created_at).toLocaleString(lang === "en" ? "en-US" : "vi-VN")}</p>
          </div>
          <button onClick={onClose} aria-label={t("Đóng")} className="rounded px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800">✕</button>
        </div>
        <p className="text-sm italic text-slate-600 dark:text-slate-300">“{s.prompt}”</p>

        {audioUrl ? <audio controls src={audioUrl} className="w-full" />
          : audioError ? <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">{t("Không tìm thấy file âm thanh (có thể đã bị xoá).")}</p>
          : <p className="text-sm text-slate-500">{t("Đang tải âm thanh...")}</p>}

        {s.metrics && (
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div><p className="text-xl font-bold">{s.metrics.duration}s</p>{t("Thời lượng")}</div>
            <div><p className="text-xl font-bold">{s.metrics.word_count}</p>{t("Số từ")}</div>
            <div><p className="text-xl font-bold">{s.metrics.words_per_minute ?? "–"}</p>{t("Từ/phút")}</div>
          </div>
        )}
        <div>
          <p className="text-sm font-medium">{t("Bản ghi chữ (transcript)")}</p>
          <p className="text-sm text-slate-600 dark:text-slate-300">{s.transcript || t("Không có bản ghi chữ cho bài nói này.")}</p>
        </div>
        <SpeakingEvaluation ev={s.evaluation} status={s.ai_status} />
        {del.error && <ErrorBox error={del.error} />}
        <div className="flex justify-end">
          <Button variant="danger" disabled={del.isPending}
            onClick={async () => { if (await ask({ title: t("Xoá bài nói này?"), message: t("Bản ghi âm và kết quả sẽ bị xoá vĩnh viễn."), confirmLabel: t("Xoá"), danger: true })) del.mutate(s.id, { onSuccess: onClose }); }}>{t("Xoá")}</Button>
        </div>
      </div>
    </div>
  );
}

export function SpeakingHistory() {
  const t = useT();
  const lang = useLang((x) => x.lang);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<SpeakingSession | null>(null);
  const q = useGet<SpeakingSession[]>(`/speaking/sessions?page=${page}&limit=6`);
  const rows = q.data?.data ?? [];

  if (q.isLoading) return <Spinner />;
  if (q.error) return <ErrorBox error={q.error} />;
  if (rows.length === 0 && page === 1) return <Empty>{t("Chưa có bài nói nào.")}</Empty>;
  return (
    <>
      <div className="space-y-2">
        {rows.map((s) => (
          <button key={s.id} onClick={() => setOpen(s)} className="w-full text-left">
            <Card className="flex items-center justify-between gap-3 text-sm transition hover:border-indigo-500">
              <span>
                <span className="font-medium">{s.topic_title}</span>
                <span className="block text-xs text-slate-500">{new Date(s.created_at).toLocaleString(lang === "en" ? "en-US" : "vi-VN")} · {t("{n} từ", { n: s.metrics?.word_count ?? 0 })} · {s.metrics?.duration ?? 0}s</span>
              </span>
              <span className="shrink-0 text-indigo-600">{t("Xem lại")} ›</span>
            </Card>
          </button>
        ))}
      </div>
      <Pager meta={q.data?.meta} onPage={setPage} />
      {open && <SessionModal s={open} onClose={() => setOpen(null)} />}
    </>
  );
}
