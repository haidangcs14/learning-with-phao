"use client";

import { BackLink } from "@/components/back-link";
import { VocabRain } from "@/components/games/vocab-rain";
import { Protected } from "@/components/protected";
import { Page } from "@/components/ui";
import { useT } from "@/lib/i18n";

export default function VocabRainPage() {
  const t = useT();
  return <Protected><Page title="🌧️ Vocabulary Rain"><div><BackLink href="/games">{t("← Danh sách trò chơi")}</BackLink></div><VocabRain /></Page></Protected>;
}
