"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { ApiMeta } from "@/lib/api";
import { useT } from "@/lib/i18n";

export function Button({
  variant = "primary",
  className = "",
  ...p
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger";
}) {
  const v = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-700",
    danger: "bg-red-600 text-white hover:bg-red-700",
    ghost:
      "border border-slate-300 text-slate-900 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800",
  }[variant];
  return (
    <button
      {...p}
      className={`rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${v} ${className}`}
    />
  );
}

export const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/60 ${className}`}
    >
      {children}
    </div>
  );
}

export function Spinner() {
  const t = useT();
  return (
    <p className="p-6 text-center text-slate-500 dark:text-slate-400">
      {t("Đang tải...")}
    </p>
  );
}

export function ErrorBox({ error }: { error: unknown }) {
  const t = useT();
  const msg = error instanceof Error ? error.message : t("Đã có lỗi xảy ra");
  return (
    <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
      {msg}
    </p>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="p-6 text-center text-slate-500 dark:text-slate-400">
      {children}
    </div>
  );
}

export function Page({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto max-w-5xl space-y-4 px-4 py-6">
      <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
      {children}
    </main>
  );
}

export function Pager({
  meta,
  onPage,
}: {
  meta?: ApiMeta | null;
  onPage: (p: number) => void;
}) {
  if (!meta || meta.total_pages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-center gap-3">
      <Button
        variant="ghost"
        disabled={meta.page <= 1}
        onClick={() => onPage(meta.page - 1)}
      >
        ←
      </Button>
      <span className="text-sm">
        {meta.page} / {meta.total_pages}
      </span>
      <Button
        variant="ghost"
        disabled={meta.page >= meta.total_pages}
        onClick={() => onPage(meta.page + 1)}
      >
        →
      </Button>
    </div>
  );
}

export function Tabs<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: readonly (readonly [T, string])[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(([k, label]) => (
        <button
          key={k}
          onClick={() => onChange(k)}
          className={`rounded-full px-4 py-1.5 text-sm transition ${value === k ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
