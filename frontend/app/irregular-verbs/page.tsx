"use client";

import { useState } from "react";
import { Button, Empty, ErrorBox, Page, Pager, Spinner, inputCls } from "@/components/ui";
import { useGet } from "@/hooks/api";
import { useT } from "@/lib/i18n";
import { useRestoreScroll, usePersistedState } from "@/lib/persist";
import { qs, speak } from "@/lib/utils";

interface Verb { id: string; base: string; past: string; past_participle: string; meaning_vi: string }

export default function IrregularVerbsPage() {
  const t = useT();
  const [input, setInput] = usePersistedState("verbs.input", "");
  const [q, setQ] = usePersistedState("verbs.q", "");
  const [page, setPage] = usePersistedState("verbs.page", 1);
  const [hide, setHide] = usePersistedState("verbs.hide", false);
  const [shown, setShown] = useState<Set<string>>(new Set());
  const res = useGet<Verb[]>(`/irregular-verbs?${qs({ q, page, limit: 20 })}`);
  const rows = res.data?.data ?? [];
  useRestoreScroll("verbs", !res.isLoading);

  const cell = (id: string, key: string, text: string) => hide && !shown.has(`${id}${key}`)
    ? <button className="rounded bg-slate-200 px-3 py-0.5 text-slate-500 dark:bg-slate-700" onClick={() => setShown(new Set(shown).add(`${id}${key}`))}>• • •</button>
    : <span>{text}</span>;

  return (
    <Page title={t("Động từ bất quy tắc")}>
      <div className="flex flex-wrap items-center gap-3">
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setQ(input); setPage(1); }}>
          <input className={`${inputCls} w-56`} placeholder={t("Tìm động từ...")} value={input} onChange={(e) => setInput(e.target.value)} />
          <Button type="submit">{t("Tìm")}</Button>
        </form>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" checked={hide} onChange={(e) => { setHide(e.target.checked); setShown(new Set()); }} />
          {t("Tự kiểm tra: ẩn V2 và V3, bấm để hiện")}
        </label>
      </div>
      {res.isLoading ? <Spinner /> : res.error ? <ErrorBox error={res.error} /> : rows.length === 0 ? <Empty>{t("Không tìm thấy động từ.")}</Empty> : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <tr><th className="p-3">{t("Nguyên mẫu (V1)")}</th><th>{t("Quá khứ (V2)")}</th><th>{t("Phân từ II (V3)")}</th><th>{t("Nghĩa")}</th><th></th></tr>
            </thead>
            <tbody>
              {rows.map((v) => (
                <tr key={v.id} className="border-t border-slate-200 dark:border-slate-800">
                  <td className="p-3 font-semibold">{v.base}</td>
                  <td>{cell(v.id, "2", v.past)}</td>
                  <td>{cell(v.id, "3", v.past_participle)}</td>
                  <td className="text-slate-500 dark:text-slate-400">{v.meaning_vi}</td>
                  <td className="pr-3 text-right"><button aria-label={t("Nghe")} onClick={() => speak(`${v.base}, ${v.past}, ${v.past_participle}`)}>🔊</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager meta={res.data?.meta} onPage={setPage} />
    </Page>
  );
}
