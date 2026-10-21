"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n";

/** Click-to-load YouTube embed (no third-party requests until the user presses play). */
export function VideoEmbed({ id, title }: { id: string; title: string }) {
  const t = useT();
  const [play, setPlay] = useState(false);
  return (
    <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
      {play ? (
        <iframe className="absolute inset-0 h-full w-full" title={title} allowFullScreen
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
          allow="accelerometer; autoplay; encrypted-media; picture-in-picture" />
      ) : (
        <button className="group absolute inset-0 flex items-center justify-center" onClick={() => setPlay(true)} aria-label={t("Phát video")}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" className="absolute inset-0 h-full w-full object-cover opacity-80" />
          <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-red-600 text-2xl text-white transition group-hover:scale-110">▶</span>
        </button>
      )}
    </div>
  );
}
