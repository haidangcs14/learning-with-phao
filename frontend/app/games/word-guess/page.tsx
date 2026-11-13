"use client";

import { BackLink } from "@/components/back-link";
import { WordGuess } from "@/components/games/word-guess";
import { Protected } from "@/components/protected";
import { Page } from "@/components/ui";
import { useT } from "@/lib/i18n";

export default function WordGuessPage() {
  const t = useT();
  return <Protected><Page title={t("🔤 Đoán Từ")}><div><BackLink href="/games">{t("← Danh sách trò chơi")}</BackLink></div><WordGuess /></Page></Protected>;
}
