"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import { Protected } from "@/components/protected";
import { StudyWorkspace, type StudySource } from "@/components/study/workspace";
import { Spinner, ErrorBox } from "@/components/ui";
import { cardToWord, type SetCard, type SetDetail } from "@/components/vocab/types";
import { useGet } from "@/hooks/api";
import { useT } from "@/lib/i18n";

function SetStudy() {
  const t = useT();
  const { id } = useParams<{ id: string }>();
  const q = useGet<SetDetail>(`/vocab-sets/${id}`);
  const d = q.data?.data;
  const source: StudySource | null = useMemo(() => !d ? null : {
    key: `set-${id}`, title: `${d.emoji} ${d.title}`,
    groups: d.groups.map((g) => ({ key: g.id, label: g.title, icon: "📂", count: g.count })),
    progressPath: `/vocab-sets/${id}/study/progress`, wordsPath: (g) => `/vocab-sets/${id}/cards?group=${encodeURIComponent(g)}`,
    learnedPath: (g) => `/vocab-sets/${id}/study/learned?group=${encodeURIComponent(g)}`, answerPath: `/vocab-sets/${id}/study/answer`,
    answerBody: (w, correct) => ({ card_id: w.id, correct }), parseWords: (raw) => (raw as SetCard[]).map(cardToWord),
    modes: ["guess", "quiz", "list"], reportable: false, backHref: "/vocabulary",
    actions: <>
      <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${d.status === "public" ? "bg-success-soft text-success-text" : "bg-accent-soft text-accent-text"}`}>{d.status === "public" ? t("Công khai") : t("Nháp")}</span>
      {d.owner && !d.is_owner && <span className="text-sm text-muted-foreground">{t("Bộ từ của {name}", { name: d.owner.full_name || d.owner.username })}</span>}
      {d.is_owner && <Link href={`/vocabulary/sets/${id}/edit`} className="lift rounded-btn border border-input bg-surface px-3 py-1 text-sm font-semibold hover:bg-surface-secondary">✏️ {t("Chỉnh sửa bộ từ")}</Link>}
    </>,
    emptyHint: d.is_owner ? <>{t("Bộ từ này chưa có thẻ nào.")} <Link href={`/vocabulary/sets/${id}/edit`} className="font-semibold text-primary-text underline">{t("Thêm thẻ ngay")}</Link></> : t("Bộ từ này chưa có thẻ nào."),
  }, [d, id, t]);
  if (q.isLoading) return <Spinner />;
  if (q.error || !source) return <div className="mx-auto max-w-3xl p-6"><ErrorBox error={q.error ?? new Error(t("Không tìm thấy bộ từ."))} /></div>;
  return <StudyWorkspace source={source} />;
}

export default function SetStudyPage() {
  return <Protected><SetStudy /></Protected>;
}
