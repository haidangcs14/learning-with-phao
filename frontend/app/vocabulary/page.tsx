"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useConfirm } from "@/components/confirm";
import { Dialog } from "@/components/dialog";
import { Protected } from "@/components/protected";
import { Button, Card, Empty, ErrorBox, Page, Pager, Spinner, Tabs, inputCls } from "@/components/ui";
import { SetTile } from "@/components/vocab/set-tile";
import type { SetSummary } from "@/components/vocab/types";
import { useGet, useSend } from "@/hooks/api";
import { useT } from "@/lib/i18n";
import { usePersistedState } from "@/lib/persist";

type Tab = "builtin" | "community" | "mine";
const EMOJIS = ["📚", "✈️", "🍜", "💼", "🏥", "🎓", "🛍️", "🏠", "⚽", "🎵", "💻", "🌍"];
const linkBtn = "lift inline-flex items-center justify-center rounded-btn px-3 py-1.5 text-sm font-bold";

function BuiltinSection() {
  const t = useT();
  const topics = useGet<{ topic: string; count: number }[]>("/words/topics");
  const progress = useGet<Record<string, number>>("/study/progress");
  const total = (topics.data?.data ?? []).reduce((s, x) => s + x.count, 0);
  const done = Object.values(progress.data?.data ?? {}).reduce((s, n) => s + n, 0);
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card className="flex flex-col gap-3 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-btn bg-primary-soft text-2xl" aria-hidden="true">📚</span>
          <div className="min-w-0"><h3 className="text-balance text-lg font-bold leading-snug">{t("{n} từ vựng thông dụng", { n: total })}</h3>
            <span className="inline-block rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-bold text-primary-text">{t("Bộ từ có sẵn")}</span></div>
        </div>
        <p className="text-pretty text-sm leading-relaxed text-muted-foreground">{t("Học theo chủ đề với 4 chế độ: Đoán, Yêu thích, Thêm vào flashcard và Trắc nghiệm.")}</p>
        <div>
          <div className="flex justify-between text-xs font-semibold text-muted-foreground"><span>{t("{a}/{b} thẻ đã thuộc", { a: done, b: total })}</span><span>{pct}%</span></div>
          <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-border" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} /></div>
        </div>
        <p className="text-xs font-semibold text-muted-foreground">{t("{n} nhóm chủ đề", { n: topics.data?.data.length ?? 0 })}</p>
        <Link href="/vocabulary/builtin" className={`${linkBtn} mt-auto bg-primary text-primary-foreground shadow-raised hover:bg-primary-hover`}>▶ {t("Học ngay")}</Link>
      </Card>
    </div>
  );
}

function CommunitySection() {
  const t = useT();
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const sets = useGet<SetSummary[]>(`/vocab-sets?scope=public&limit=12&page=${page}${q ? `&q=${encodeURIComponent(q)}` : ""}`);
  const items = sets.data?.data ?? [];
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input className={inputCls} value={text} placeholder={t("Tìm bộ từ vựng...")} aria-label={t("Tìm bộ từ vựng...")} maxLength={80} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { setQ(text.trim()); setPage(1); } }} />
        <Button onClick={() => { setQ(text.trim()); setPage(1); }}>{t("Tìm")}</Button>
      </div>
      {sets.isLoading ? <Spinner /> : sets.error ? <ErrorBox error={sets.error} />
        : items.length === 0 ? <Empty>{q ? t("Không có bộ từ nào khớp với tìm kiếm.") : t("Chưa có bộ từ nào được chia sẻ. Hãy là người đầu tiên!")}</Empty>
        : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{items.map((s) => (
            <SetTile key={s.id} set={s} actions={<Link href={`/vocabulary/sets/${s.id}`} className={`${linkBtn} bg-primary text-primary-foreground hover:bg-primary-hover`}>▶ {t("Học")}</Link>} />
          ))}</div>}
      <Pager meta={sets.data?.meta} onPage={setPage} />
    </div>
  );
}

function MineSection() {
  const t = useT();
  const router = useRouter();
  const confirm = useConfirm();
  const mine = useGet<SetSummary[]>("/vocab-sets?scope=mine");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", emoji: "📚" });
  const create = useSend<{ id: string }, typeof form>("POST", "/vocab-sets", ["/vocab-sets"]);
  const remove = useSend<unknown, string>("DELETE", (id) => `/vocab-sets/${id}`, ["/vocab-sets"]);
  const reorder = useSend<unknown, string[]>("POST", "/vocab-sets/reorder", ["/vocab-sets"], (ids) => ({ ids }));
  const items = mine.data?.data ?? [];

  function move(i: number, d: -1 | 1) {
    const ids = items.map((s) => s.id), j = i + d;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j] as string, ids[i] as string];
    reorder.mutate(ids);
  }
  async function del(s: SetSummary) {
    if (await confirm({ title: t("Xóa bộ từ vựng?"), message: t("Toàn bộ nhóm và thẻ trong bộ “{name}” sẽ bị xóa vĩnh viễn.", { name: s.title }), confirmLabel: t("Xóa"), danger: true })) remove.mutate(s.id);
  }
  const arrow = "flex h-7 w-7 items-center justify-center rounded-btn border border-border bg-surface text-xs hover:bg-surface-secondary disabled:cursor-not-allowed disabled:opacity-40";
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-muted-foreground">{t("Tạo bộ từ vựng riêng: đặt tên bộ, tạo các nhóm thẻ rồi thêm thẻ vào từng nhóm. Bộ mới luôn ở trạng thái Nháp cho đến khi bạn chọn Công khai.")}</p>
        <Button onClick={() => { setForm({ title: "", description: "", emoji: "📚" }); setCreating(true); }}>＋ {t("Tạo bộ từ vựng")}</Button>
      </div>
      {mine.isLoading ? <Spinner /> : mine.error ? <ErrorBox error={mine.error} /> : items.length === 0 ? <Empty>{t("Bạn chưa có bộ từ vựng nào.")}</Empty> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((s, i) => (
            <SetTile key={s.id} set={s} mine
              tools={items.length > 1 ? <span className="flex flex-col gap-1"><button className={arrow} onClick={() => move(i, -1)} disabled={i === 0 || reorder.isPending} aria-label={t("Chuyển lên")}>▲</button><button className={arrow} onClick={() => move(i, 1)} disabled={i === items.length - 1 || reorder.isPending} aria-label={t("Chuyển xuống")}>▼</button></span> : undefined}
              actions={<>
                {s.card_count > 0 && <Link href={`/vocabulary/sets/${s.id}`} className={`${linkBtn} border border-input bg-surface hover:bg-surface-secondary`}>▶ {t("Học")}</Link>}
                <Link href={`/vocabulary/sets/${s.id}/edit`} className={`${linkBtn} bg-primary text-primary-foreground hover:bg-primary-hover`}>✏️ {t("Chỉnh sửa")}</Link>
                <button onClick={() => void del(s)} aria-label={t("Xóa")} title={t("Xóa")} className={`${linkBtn} border border-input bg-surface text-error-text hover:bg-error-soft`}>🗑</button>
              </>} />
          ))}
        </div>
      )}
      {remove.error && <ErrorBox error={remove.error} />}

      <Dialog open={creating} title={t("Tạo bộ từ vựng")} onClose={() => setCreating(false)}>
        <div className="space-y-3 text-sm">
          <label className="block font-medium">{t("Tên bộ từ vựng")} <span className="text-error-text">*</span>
            <input className={`${inputCls} mt-1`} value={form.title} maxLength={80} placeholder={t("VD: Từ vựng du lịch")} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
          <label className="block font-medium">{t("Mô tả (tùy chọn)")}
            <textarea className={`${inputCls} mt-1 min-h-20 resize-y`} value={form.description} maxLength={300} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
          <div><p className="mb-1 font-medium">{t("Biểu tượng")}</p>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t("Biểu tượng")}>{EMOJIS.map((e) => (
              <button key={e} role="radio" aria-checked={form.emoji === e} onClick={() => setForm({ ...form, emoji: e })} className={`flex h-10 w-10 items-center justify-center rounded-btn border-2 text-xl ${form.emoji === e ? "border-primary bg-primary-soft" : "border-border bg-surface hover:border-primary/60"}`}>{e}</button>))}</div></div>
          {create.error && <ErrorBox error={create.error} />}
          <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setCreating(false)}>{t("Hủy")}</Button>
            <Button disabled={!form.title.trim() || create.isPending} onClick={() => create.mutate(form, { onSuccess: (r) => { setCreating(false); router.push(`/vocabulary/sets/${r.data.id}/edit`); } })}>{t("Tạo bộ từ")}</Button></div>
        </div>
      </Dialog>
    </div>
  );
}

function Library() {
  const t = useT();
  const [tab, setTab] = usePersistedState<Tab>("vocab.library.tab", "builtin");
  return (
    <Page title={t("Từ vựng")}>
      <Tabs<Tab> value={tab} onChange={setTab} options={[["builtin", t("Bộ từ có sẵn")], ["community", t("Cộng đồng")], ["mine", t("Của tôi")]]} />
      {tab === "builtin" ? <BuiltinSection /> : tab === "community" ? <CommunitySection /> : <MineSection />}
    </Page>
  );
}

export default function VocabularyPage() {
  return <Protected><Library /></Protected>;
}
