"use client";

import { useEffect, useState } from "react";
import { CardMatching } from "@/components/games/card-matching";
import { FillBlank } from "@/components/games/fill-blank";
import { Protected } from "@/components/protected";
import { Page, Tabs } from "@/components/ui";
import { useT } from "@/lib/i18n";

export default function GamesPage() {
  const t = useT();
  const [game, setGame] = useState<"match" | "blank">("match");
  useEffect(() => { // /games?game=blank opens the fill-in-the-blank game directly
    if (new URLSearchParams(window.location.search).get("game") === "blank") setGame("blank");
  }, []);
  return (
    <Protected>
      <Page title={t("Trò chơi")}>
        <Tabs value={game} onChange={setGame} options={[["match", "🃏 Card Matching"], ["blank", t("✏️ Điền vào chỗ trống")]] as const} />
        {game === "match" ? <CardMatching /> : <FillBlank />}
      </Page>
    </Protected>
  );
}
