"use client";

import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import type { ApiMeta } from "@/lib/api";
import { ApiError } from "@/lib/api";
import { useT } from "@/lib/i18n";

/** Text fields: tokens only, so they follow the theme. Hover, focus and invalid states are visible without relying on colour alone. */
export const inputCls =
  "w-full rounded-btn border border-input bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground transition duration-150 ease-out hover:border-primary/50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-error aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-error/30";

const VARIANT = {
  primary: "border border-transparent bg-primary text-primary-foreground hover:bg-primary-hover",
  ghost: "border border-input bg-surface text-foreground hover:border-primary/50 hover:bg-surface-secondary",
  danger: "border border-transparent bg-error text-error-foreground hover:bg-error/90",
} as const;

/** Buttons: 12px radius, 700 weight, 150ms transition. The global base styles lift them 1px on hover and press them 1px on click. */
export function Button({ variant = "primary", className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof VARIANT }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-btn px-4 py-2 text-sm font-bold shadow-sm transition duration-150 ease-out hover:shadow-md active:shadow-none disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none ${VARIANT[variant]} ${className}`}
    />
  );
}

/** Card: 18px radius, hairline border, soft shadow and the "raised block" depth under it. `interactive` adds the hover lift. */
export function Card({ className = "", interactive = false, ...props }: HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      {...props}
      className={`rounded-card border border-border bg-surface p-4 text-foreground shadow-raised transition duration-200 ${interactive ? "hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-raised-hover" : ""} ${className}`}
    />
  );
}

export function Spinner() {
  const t = useT();
  return (
    <div className="flex justify-center p-8" role="status" aria-label={t("Đang tải...")}>
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-soft border-t-primary" />
    </div>
  );
}

export function ErrorBox({ error }: { error: unknown }) {
  const t = useT();
  const msg = error instanceof ApiError ? error.message : error instanceof Error ? error.message : t("Đã có lỗi xảy ra");
  return <div role="alert" className="rounded-btn border border-error/40 bg-error-soft p-3 text-sm font-medium text-error-text">{msg}</div>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-card border-2 border-dashed border-border bg-surface/60 p-8 text-center text-muted-foreground">{children}</div>;
}

/** `title` names the page for screen readers and the document outline; it is only drawn on screen with `visibleTitle`
 *  (use that when the title is content: an exam name, a word, a greeting). */
export function Page({ title, children, visibleTitle = false }: { title: string; children: ReactNode; visibleTitle?: boolean }) {
  return (
    <main className={`mx-auto max-w-5xl space-y-6 px-4 ${visibleTitle ? "py-8" : "pb-8 pt-6"}`}>
      <h1 className={visibleTitle ? "text-3xl font-bold tracking-tight text-foreground" : "sr-only"}>{title}</h1>
      {children}
    </main>
  );
}

export function Pager({ meta, onPage }: { meta?: ApiMeta | null; onPage: (p: number) => void }) {
  if (!meta || meta.total_pages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-center gap-3">
      <Button variant="ghost" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)} aria-label="←">←</Button>
      <span className="text-sm font-medium text-muted-foreground">{meta.page} / {meta.total_pages}</span>
      <Button variant="ghost" disabled={meta.page >= meta.total_pages} onClick={() => onPage(meta.page + 1)} aria-label="→">→</Button>
    </div>
  );
}

export function Tabs<T extends string>({ value, options, onChange }: { value: T; options: readonly (readonly [T, string])[]; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-2" role="tablist">
      {options.map(([v, label]) => (
        <button key={v} role="tab" aria-selected={value === v} onClick={() => onChange(v)}
          className={`rounded-btn border px-3.5 py-1.5 text-sm font-semibold transition duration-150 ${value === v ? "border-primary bg-primary text-primary-foreground shadow-sm" : "border-input bg-surface text-foreground hover:border-primary/50 hover:bg-primary-soft"}`}>
          {label}
        </button>
      ))}
    </div>
  );
}
