"use client";

import { BackLink } from "@/components/back-link";
import { WordBridge } from "@/components/games/word-bridge";
import { Protected } from "@/components/protected";
import { Page } from "@/components/ui";
import { useT } from "@/lib/i18n";

export default function WordBridgePage() {
  const t = useT();
  return <Protected><Page title="🌉 Word Bridge"><div><BackLink href="/games">{t("← Danh sách trò chơi")}</BackLink></div><WordBridge /></Page></Protected>;
}
