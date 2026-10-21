"use client";

import { useCallback, useState } from "react";
import { IpaModal, type Phoneme } from "@/components/ipa-modal";
import { Empty, ErrorBox, Page, Spinner } from "@/components/ui";
import { useGet } from "@/hooks/api";
import { useT } from "@/lib/i18n";
import { speak } from "@/lib/utils";

const SECTIONS = [["vowel", "Nguyên âm"], ["diphthong", "Nguyên âm đôi"], ["consonant", "Phụ âm"]] as const;

export default function IpaPage() {
  const t = useT();
  const q = useGet<Phoneme[]>("/ipa?limit=100");
  const [active, setActive] = useState<number | null>(null);
  const close = useCallback(() => setActive(null), []);
  const items = q.data?.data ?? [];

  if (q.isLoading) return <Spinner />;
  if (q.error) return <div className="p-6"><ErrorBox error={q.error} /></div>;
  if (items.length === 0) return <Empty>{t("Chưa có dữ liệu IPA. Hãy chạy seed.")}</Empty>;

  return (
    <Page title={t("Bảng phiên âm IPA")}>
      <p className="text-slate-500 dark:text-slate-400">{t("Bấm vào một âm để xem cách phát âm, từ ví dụ và video.")}</p>
      {SECTIONS.map(([type, label]) => (
        <section key={type}>
          <h2 className="mb-3 mt-4 text-xl font-semibold">{t(label)}</h2>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
            {items.map((p, i) => p.type === type && (
              <button key={p.id} onClick={() => { setActive(i); speak(p.example_words[0] ?? p.symbol); }}
                className="rounded-xl border border-slate-200 bg-white p-3 text-center transition hover:-translate-y-0.5 hover:border-indigo-500 hover:shadow dark:border-slate-800 dark:bg-slate-900/60">
                <div className="text-2xl font-semibold">/{p.symbol}/</div>
                <div className="mt-1 text-xs text-slate-500">{p.example_words[0]}</div>
              </button>
            ))}
          </div>
        </section>
      ))}
      {active !== null && <IpaModal items={items} index={active} onClose={close} onIndex={setActive} />}
    </Page>
  );
}
