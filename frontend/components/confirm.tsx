"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useT } from "@/lib/i18n";

export interface ConfirmOptions { title: string; message?: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean }
type Ask = (options: ConfirmOptions) => Promise<boolean>;
const ConfirmContext = createContext<Ask | null>(null);

/** `const ask = useConfirm(); if (await ask({ title: "Delete?", danger: true })) ...` */
export function useConfirm(): Ask {
  const ask = useContext(ConfirmContext);
  if (!ask) throw new Error("useConfirm must be used inside <ConfirmProvider>");
  return ask;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const t = useT();
  const [pending, setPending] = useState<{ options: ConfirmOptions; resolve: (v: boolean) => void } | null>(null);
  const okButton = useRef<HTMLButtonElement>(null);
  const ask = useCallback<Ask>((options) => new Promise<boolean>((resolve) => setPending({ options, resolve })), []);

  const close = useCallback((value: boolean) => {
    pending?.resolve(value);
    setPending(null);
  }, [pending]);

  useEffect(() => {
    if (!pending) return;
    okButton.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending, close]);

  const o = pending?.options;
  return (
    <ConfirmContext.Provider value={ask}>
      {children}
      {o && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onClick={() => close(false)}>
          <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" onClick={(e) => e.stopPropagation()}
            className="animate-modal w-full max-w-sm rounded-2xl bg-white p-5 text-slate-900 shadow-2xl dark:bg-slate-900 dark:text-slate-100">
            <div className="flex gap-3">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg font-bold ${o.danger ? "bg-red-100 text-red-600 dark:bg-red-950" : "bg-indigo-100 text-indigo-600 dark:bg-indigo-950"}`}>{o.danger ? "!" : "?"}</span>
              <div>
                <h2 id="confirm-title" className="font-semibold">{o.title}</h2>
                {o.message && <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{o.message}</p>}
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => close(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">{o.cancelLabel ?? t("Huỷ bỏ")}</button>
              <button ref={okButton} onClick={() => close(true)}
                className={`rounded-lg px-4 py-2 text-sm font-medium text-white ${o.danger ? "bg-red-600 hover:bg-red-700" : "bg-indigo-600 hover:bg-indigo-700"}`}>{o.confirmLabel ?? t("Xác nhận")}</button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
