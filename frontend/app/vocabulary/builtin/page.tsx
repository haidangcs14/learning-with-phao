"use client";

import { useMemo } from "react";
import { Protected } from "@/components/protected";
import { StudyWorkspace, type StudySource } from "@/components/study/workspace";
import { useGet } from "@/hooks/api";
import { useT } from "@/lib/i18n";
import { topicInfo } from "@/lib/topics";
import { qs } from "@/lib/utils";
import { useLang } from "@/store/lang-store";
import type { Word } from "@/types";

function Builtin() {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const topics = useGet<{ topic: string; count: number }[]>("/words/topics");
  const all = topics.data?.data ?? [];
  const total = all.reduce((s, x) => s + x.count, 0);
  const source: StudySource = useMemo(() => ({
    key: "builtin", title: t("{n} từ vựng thông dụng", { n: total }), loading: topics.isLoading, error: topics.error,
    groups: all.map((x) => ({ key: x.topic, label: topicInfo(x.topic, lang).label, icon: topicInfo(x.topic, lang).icon, count: x.count })),
    progressPath: "/study/progress", wordsPath: (g) => `/words?${qs({ topic: g, limit: 100 })}`, learnedPath: (g) => `/study/learned?topic=${encodeURIComponent(g)}`,
    answerPath: "/study/answer", answerBody: (w, correct) => ({ word_id: w.id, correct }), parseWords: (raw) => raw as Word[],
    modes: ["guess", "favorites", "flashcard", "quiz"], reportable: true, backHref: "/vocabulary",
  }), [all, total, lang, topics.isLoading, topics.error, t]);
  return <StudyWorkspace source={source} />;
}

export default function BuiltinVocabularyPage() {
  return <Protected><Builtin /></Protected>;
}
