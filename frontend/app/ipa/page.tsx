"use client";

import { useCallback, useState } from "react";
import { IpaModal, type Phoneme } from "@/components/ipa-modal";
import { Empty, ErrorBox, Page, Spinner } from "@/components/ui";
import { useGet } from "@/hooks/api";
import { useT } from "@/lib/i18n";
import { speak } from "@/lib/utils";

// Vietnamese text is the translation key (English in lib/i18n.ts). Classes are written out in full so Tailwind can see them.
const SECTIONS = [
  { type: "vowel", label: "Nguyên âm", box: "border-primary/60 bg-primary-soft/40", chip: "bg-primary text-primary-foreground", hover: "hover:border-primary" },
  { type: "diphthong", label: "Nguyên âm đôi", box: "border-secondary/70 bg-secondary-soft/40", chip: "bg-secondary text-secondary-foreground", hover: "hover:border-secondary" },
  { type: "consonant", label: "Phụ âm", box: "border-accent/80 bg-accent-soft/50", chip: "bg-accent text-accent-foreground", hover: "hover:border-accent" },
] as const;

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
      <p className="text-muted-foreground">{t("Bấm vào một âm để xem cách phát âm, từ ví dụ và video.")}</p>
      {SECTIONS.map((s) => (
        <section key={s.type} className={`rounded-card border-2 p-4 ${s.box}`} aria-label={t(s.label)}>
          <h2 className="mb-3 flex items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-sm font-bold shadow-sm ${s.chip}`}>{t(s.label)}</span>
            <span className="text-sm font-medium text-muted-foreground">{items.filter((p) => p.type === s.type).length}</span>
          </h2>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
            {items.map((p, i) => p.type === s.type && (
              <button key={p.id} onClick={() => { setActive(i); speak(p.example_words[0] ?? p.symbol); }}
                className={`rounded-card border border-border bg-surface p-3 text-center shadow-raised transition hover:-translate-y-0.5 hover:shadow-raised-hover ${s.hover}`}>
                <div className="text-2xl font-semibold">/{p.symbol}/</div>
                <div className="mt-1 text-xs text-muted-foreground">{p.example_words[0]}</div>
              </button>
            ))}
          </div>
        </section>
      ))}
      {active !== null && <IpaModal items={items} index={active} onClose={close} onIndex={setActive} />}
    </Page>
  );
}
