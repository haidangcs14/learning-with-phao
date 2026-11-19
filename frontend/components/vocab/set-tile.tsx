"use client";

import type { ReactNode } from "react";
import { Avatar } from "@/components/avatar";
import type { SetSummary } from "@/components/vocab/types";
import { useT } from "@/lib/i18n";

export function StatusBadge({ status }: { status: "draft" | "public" }) {
  const t = useT();
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${status === "public" ? "bg-success-soft text-success-text" : "bg-accent-soft text-accent-text"}`}>{status === "public" ? t("Công khai") : t("Nháp")}</span>;
}

/** One vocabulary set as a card. Heights follow the content (nothing is cut off). */
export function SetTile({ set, mine = false, actions, tools }: { set: SetSummary; mine?: boolean; actions?: ReactNode; tools?: ReactNode }) {
  const t = useT();
  return (
    <article className="flex h-full flex-col rounded-card border border-border bg-surface p-4 shadow-raised transition duration-200 hover:-translate-y-0.5 hover:shadow-raised-hover sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-btn bg-primary-soft text-2xl" aria-hidden="true">{set.emoji}</span>
        <div className="min-w-0 flex-1">
          <h3 className="text-balance text-lg font-bold leading-snug [overflow-wrap:anywhere]">{set.title}</h3>
          {mine && <div className="mt-1"><StatusBadge status={set.status} /></div>}
        </div>
        {tools}
      </div>
      {set.description && <p className="mt-3 text-pretty text-sm leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">{set.description}</p>}
      <p className="mt-3 text-xs font-semibold text-muted-foreground">{t("{g} nhóm · {c} thẻ", { g: set.group_count, c: set.card_count })}</p>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-4">
        {!mine && set.owner ? <span className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground"><Avatar user={set.owner} size={24} /><span className="truncate">{set.owner.full_name || set.owner.username}</span></span> : <span />}
        <span className="flex flex-wrap items-center gap-2">{actions}</span>
      </div>
    </article>
  );
}
