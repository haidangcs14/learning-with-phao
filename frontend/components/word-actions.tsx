"use client";

import { useGet, useSend } from "@/hooks/api";
import { useT } from "@/lib/i18n";
import { speak } from "@/lib/utils";
import { useAuth } from "@/store/auth-store";
import type { Favorite } from "@/types";
import { Button } from "@/components/ui";

export function useFavoriteIds() {
  const user = useAuth((s) => s.user);
  const favs = useGet<Favorite[]>(user ? "/favorites?target_type=word&limit=100" : null);
  return { favs, ids: new Set(favs.data?.data.map((f) => f.target_id)) };
}

export function WordActions({ id, word, isFav }: { id: string; word: string; isFav: boolean }) {
  const t = useT();
  const user = useAuth((s) => s.user);
  const add = useSend<unknown, { target_type: string; target_id: string }>("POST", "/favorites", ["/favorites"]);
  const del = useSend<unknown, string>("DELETE", (x) => `/favorites/${x}?target_type=word`, ["/favorites"]);
  const card = useSend<unknown, { word_id: string }>("POST", "/flashcards", ["/flashcards"]);
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="ghost" onClick={() => speak(word)} aria-label={t("Nghe")}>🔊</Button>
      {user && (
        <>
          <Button variant="ghost" disabled={add.isPending || del.isPending}
            onClick={() => (isFav ? del.mutate(id) : add.mutate({ target_type: "word", target_id: id }))}>
            {isFav ? t("♥ Đã thích") : t("♡ Yêu thích")}
          </Button>
          <Button variant="ghost" disabled={card.isPending || card.isSuccess} onClick={() => card.mutate({ word_id: id })}>
            {card.isSuccess ? t("✓ Đã thêm") : t("+ Flashcard")}
          </Button>
        </>
      )}
    </div>
  );
}
