"use client";

import { BackLink } from "@/components/back-link";
import { CardMatching } from "@/components/games/card-matching";
import { Protected } from "@/components/protected";
import { Page } from "@/components/ui";
import { useT } from "@/lib/i18n";

export default function MatchingPage() {
  const t = useT();
  return <Protected><Page title="Card Matching"><div><BackLink href="/games">{t("← Danh sách trò chơi")}</BackLink></div><CardMatching /></Page></Protected>;
}
