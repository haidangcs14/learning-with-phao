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
  if (failed) return <p className="rounded-btn bg-accent-soft p-3 text-sm text-accent-text">{t("Không tải được file nghe.")}</p>;
  return (
    <div className="rounded-xl border border-primary/40 bg-primary-soft p-3">
      <p className="mb-1 text-sm font-semibold">🎧 {t("Phần nghe")}</p>
      {url ? <audio controls src={url} className="w-full" /> : <p className="text-sm text-muted-foreground">{t("Đang tải âm thanh...")}</p>}
    </div>
  );
}
