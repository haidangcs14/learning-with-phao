"use client";

import { useEffect, useState } from "react";
import { apiBlob } from "@/lib/api";
import { useT } from "@/lib/i18n";

export function ExamAudio({ examId }: { examId: string }) {
  const t = useT();
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => { // the endpoint needs the login token, so the audio is fetched as a blob
    let objectUrl: string | null = null;
    let cancelled = false;
    apiBlob(`/exams/${examId}/audio`).then((b) => { if (!cancelled) { objectUrl = URL.createObjectURL(b); setUrl(objectUrl); } }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [examId]);
  if (failed) return <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">{t("Không tải được file nghe.")}</p>;
  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 dark:border-indigo-900 dark:bg-indigo-950/40">
      <p className="mb-1 text-sm font-semibold">🎧 {t("Phần nghe")}</p>
      {url ? <audio controls src={url} className="w-full" /> : <p className="text-sm text-slate-500">{t("Đang tải âm thanh...")}</p>}
    </div>
  );
}
