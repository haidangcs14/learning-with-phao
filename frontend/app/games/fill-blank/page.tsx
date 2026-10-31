"use client";

import { BackLink } from "@/components/back-link";
import { FillBlank } from "@/components/games/fill-blank";
import { Protected } from "@/components/protected";
import { Page } from "@/components/ui";
import { useT } from "@/lib/i18n";

export default function FillBlankPage() {
  const t = useT();
  return <Protected><Page title={t("✏️ Điền vào chỗ trống")}><div><BackLink href="/games">{t("← Danh sách trò chơi")}</BackLink></div><FillBlank /></Page></Protected>;
}
