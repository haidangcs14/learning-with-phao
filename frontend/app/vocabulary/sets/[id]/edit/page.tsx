"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { BackLink } from "@/components/back-link";
import { useConfirm } from "@/components/confirm";
import { Dialog } from "@/components/dialog";
import { Protected } from "@/components/protected";
import { POS } from "@/components/study/utils";
import { Button, Card, ErrorBox, Spinner, inputCls } from "@/components/ui";
import { CardDialog, type CardValues } from "@/components/vocab/card-dialog";
import { StatusBadge } from "@/components/vocab/set-tile";
import type { SetCard, SetDetail } from "@/components/vocab/types";
import { useGet, useSend } from "@/hooks/api";
import { useT } from "@/lib/i18n";

const MIN_PUBLIC = 4; // same rule as the server
const EMOJIS = ["📚", "✈️", "🍜", "💼", "🏥", "🎓", "🛍️", "🏠", "⚽", "🎵", "💻", "🌍"];
const tool = "flex h-8 w-8 items-center justify-center rounded-btn border border-border bg-surface text-sm hover:bg-surface-secondary disabled:cursor-not-allowed disabled:opacity-40";

function swap<T>(arr: T[], i: number, j: number): T[] { const a = [...arr]; [a[i], a[j]] = [a[j] as T, a[i] as T]; return a; }

function Editor() {
  const t = useT();
  const router = useRouter();
  const confirm = useConfirm();
  const { id } = useParams<{ id: string }>();
  const detail = useGet<SetDetail>(`/vocab-sets/${id}`);
  const cardsQ = useGet<SetCard[]>(`/vocab-sets/${id}/cards`);
  const inv = ["/vocab-sets"];
  const patchSet = useSend<unknown, { title: string; description: string; emoji: string }>("PATCH", `/vocab-sets/${id}`, inv);
  const publish = useSend<unknown, { confirm: boolean }>("POST", `/vocab-sets/${id}/publish`, inv);
  const unpublish = useSend<unknown, void>("POST", `/vocab-sets/${id}/unpublish`, inv);
  const delSet = useSend<unknown, void>("DELETE", `/vocab-sets/${id}`, inv);
  const addGroup = useSend<unknown, { title: string }>("POST", `/vocab-sets/${id}/groups`, inv);
  const renameGroup = useSend<unknown, { gid: string; title: string }>("PATCH", (v) => `/vocab-sets/${id}/groups/${v.gid}`, inv, (v) => ({ title: v.title }));
  const delGroup = useSend<unknown, string>("DELETE", (gid) => `/vocab-sets/${id}/groups/${gid}`, inv);
  const reorderGroups = useSend<unknown, string[]>("POST", `/vocab-sets/${id}/groups/reorder`, inv, (ids) => ({ ids }));
  const addCard = useSend<unknown, { gid: string; values: CardValues }>("POST", (v) => `/vocab-sets/${id}/groups/${v.gid}/cards`, inv, (v) => v.values);
  const editCard = useSend<unknown, { cid: string; values: CardValues; group_id: string }>("PATCH", (v) => `/vocab-sets/${id}/cards/${v.cid}`, inv, (v) => ({ ...v.values, group_id: v.group_id }));
  const delCard = useSend<unknown, string>("DELETE", (cid) => `/vocab-sets/${id}/cards/${cid}`, inv);
  const reorderCards = useSend<unknown, { gid: string; ids: string[] }>("POST", (v) => `/vocab-sets/${id}/groups/${v.gid}/cards/reorder`, inv, (v) => ({ ids: v.ids }));

  const [info, setInfo] = useState<{ title: string; description: string; emoji: string } | null>(null);
  const [nameDlg, setNameDlg] = useState<{ gid?: string; value: string } | null>(null);
  const [cardDlg, setCardDlg] = useState<{ gid: string; card?: SetCard } | null>(null);
  const [publishDlg, setPublishDlg] = useState(false);
  const [agree, setAgree] = useState(false);
  const [closed, setClosed] = useState<Set<string>>(new Set());

  const d = detail.data?.data;
  const cards = cardsQ.data?.data ?? [];
  if (detail.isLoading) return <Spinner />;
  if (detail.error || !d) return <div className="mx-auto max-w-3xl p-6"><ErrorBox error={detail.error ?? new Error(t("Không tìm thấy bộ từ."))} /></div>;
  if (!d.is_owner) {
    return <div className="mx-auto max-w-3xl space-y-3 p-6"><p className="rounded-card border border-border bg-surface p-4">{t("Chỉ chủ sở hữu mới được chỉnh sửa bộ từ này.")}</p><Link href={`/vocabulary/sets/${id}`} className="font-semibold text-primary-text underline">{t("Xem bộ từ")}</Link></div>;
  }
  const inGroup = (gid: string) => cards.filter((c) => c.group_id === gid);
  const toggle = (gid: string) => setClosed((s) => { const n = new Set(s); if (n.has(gid)) n.delete(gid); else n.add(gid); return n; });
  const enough = d.card_count >= MIN_PUBLIC;

  async function removeSet() {
    if (await confirm({ title: t("Xóa bộ từ vựng?"), message: t("Toàn bộ nhóm và thẻ trong bộ “{name}” sẽ bị xóa vĩnh viễn.", { name: d?.title ?? "" }), confirmLabel: t("Xóa"), danger: true }))
      delSet.mutate(undefined, { onSuccess: () => router.push("/vocabulary") });
  }
  async function removeGroup(gid: string, title: string, n: number) {
    if (await confirm({ title: t("Xóa nhóm?"), message: t("Nhóm “{name}” và {n} thẻ trong nhóm sẽ bị xóa.", { name: title, n }), confirmLabel: t("Xóa"), danger: true })) delGroup.mutate(gid);
  }
  async function removeCard(c: SetCard) {
    if (await confirm({ title: t("Xóa thẻ?"), message: t("Thẻ “{name}” sẽ bị xóa.", { name: c.word }), confirmLabel: t("Xóa"), danger: true })) delCard.mutate(c.id);
  }
  async function makePrivate() {
    if (await confirm({ title: t("Hủy công khai?"), message: t("Bộ từ sẽ trở về trạng thái Nháp và không còn hiển thị với cộng đồng."), confirmLabel: t("Hủy công khai") })) unpublish.mutate();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-6">
      <div><BackLink href="/vocabulary">{t("← Thư viện bộ từ")}</BackLink></div>

      <Card className="space-y-3 sm:p-5">
        <div className="flex flex-wrap items-start gap-3">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-btn bg-primary-soft text-3xl" aria-hidden="true">{d.emoji}</span>
          <div className="min-w-0 flex-1">
            <h1 className="text-balance text-2xl font-bold leading-snug [overflow-wrap:anywhere]">{d.title}</h1>
            {d.description && <p className="mt-1 text-pretty text-sm leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">{d.description}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-2"><StatusBadge status={d.status} /><span className="text-xs font-semibold text-muted-foreground">{t("{g} nhóm · {c} thẻ", { g: d.group_count, c: d.card_count })}</span></div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => setInfo({ title: d.title, description: d.description, emoji: d.emoji })}>✏️ {t("Đổi tên / mô tả")}</Button>
            {d.card_count > 0 && <Link href={`/vocabulary/sets/${id}`} className="lift inline-flex items-center rounded-btn border border-input bg-surface px-4 py-2 text-sm font-bold hover:bg-surface-secondary">▶ {t("Học thử")}</Link>}
            <Button variant="danger" onClick={() => void removeSet()} aria-label={t("Xóa bộ từ vựng?")}>🗑</Button>
          </div>
        </div>
        <div className={`flex flex-wrap items-center justify-between gap-3 rounded-btn border p-3 text-sm ${d.status === "public" ? "border-success/40 bg-success-soft" : "border-accent/50 bg-accent-soft"}`}>
          <p className="min-w-0 flex-1 text-pretty">{d.status === "public" ? t("Bộ từ đang Công khai: mọi người trong cộng đồng đều có thể xem và học.") : t("Bộ từ đang ở trạng thái Nháp: chỉ mình bạn nhìn thấy.")}</p>
          {d.status === "public"
            ? <Button variant="ghost" disabled={unpublish.isPending} onClick={() => void makePrivate()}>{t("Hủy công khai")}</Button>
            : <Button onClick={() => { setAgree(false); setPublishDlg(true); }}>🌍 {t("Công khai…")}</Button>}
        </div>
        {unpublish.error && <ErrorBox error={unpublish.error} />}
        {delSet.error && <ErrorBox error={delSet.error} />}
      </Card>

      <div><Button onClick={() => setNameDlg({ value: "" })}>＋ {t("Thêm nhóm")}</Button></div>
      {addGroup.error && <ErrorBox error={addGroup.error} />}

      {d.groups.length === 0 ? (
        <p className="rounded-card border-2 border-dashed border-border p-8 text-center text-muted-foreground">{t("Chưa có nhóm nào. Hãy tạo nhóm đầu tiên rồi thêm thẻ vào nhóm.")}</p>
      ) : (
        <ul className="space-y-4">
          {d.groups.map((g, gi) => {
            const list = inGroup(g.id), open = !closed.has(g.id);
            return (
              <li key={g.id} className="rounded-card border border-border bg-surface shadow-raised">
                <div className="flex flex-wrap items-center gap-2 p-3 sm:p-4">
                  <button onClick={() => toggle(g.id)} aria-expanded={open} aria-label={open ? t("Thu gọn") : t("Mở rộng")} className={tool}>{open ? "−" : "+"}</button>
                  <h2 className="min-w-0 flex-1 text-balance text-lg font-bold leading-snug [overflow-wrap:anywhere]">{g.title} <span className="text-sm font-semibold text-muted-foreground">({list.length})</span></h2>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button className={tool} onClick={() => reorderGroups.mutate(swap(d.groups.map((x) => x.id), gi, gi - 1))} disabled={gi === 0 || reorderGroups.isPending} aria-label={t("Chuyển lên")}>▲</button>
                    <button className={tool} onClick={() => reorderGroups.mutate(swap(d.groups.map((x) => x.id), gi, gi + 1))} disabled={gi === d.groups.length - 1 || reorderGroups.isPending} aria-label={t("Chuyển xuống")}>▼</button>
                    <button className={tool} onClick={() => setNameDlg({ gid: g.id, value: g.title })} aria-label={t("Đổi tên nhóm")} title={t("Đổi tên nhóm")}>✏️</button>
                    <button className={`${tool} text-error-text`} onClick={() => void removeGroup(g.id, g.title, list.length)} aria-label={t("Xóa nhóm?")} title={t("Xóa nhóm?")}>🗑</button>
                    <Button onClick={() => setCardDlg({ gid: g.id })}>＋ {t("Thêm thẻ")}</Button>
                  </div>
                </div>
                {open && (
                  <div className="border-t border-border p-3 sm:p-4">
                    {list.length === 0 ? <p className="py-3 text-center text-sm text-muted-foreground">{t("Nhóm này chưa có thẻ nào.")}</p> : (
                      <ul className="space-y-2">
                        {list.map((c, ci) => (
                          <li key={c.id} className="flex flex-wrap items-start gap-2 rounded-btn border border-border bg-background p-3">
                            <div className="min-w-0 flex-1">
                              <p className="[overflow-wrap:anywhere]"><b className="text-base">{c.word}</b> <span className="text-xs text-muted-foreground">{c.phonetic}</span>
                                {c.pos && <span className="ml-2 rounded-full bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary-text">{t(POS[c.pos] ?? "Khác")}</span>}</p>
                              <p className="text-sm leading-snug text-muted-foreground [overflow-wrap:anywhere]">{c.translation}</p>
                              {c.example_en && <p className="mt-0.5 text-sm italic leading-snug text-muted-foreground [overflow-wrap:anywhere]">{c.example_en}</p>}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button className={tool} onClick={() => reorderCards.mutate({ gid: g.id, ids: swap(list.map((x) => x.id), ci, ci - 1) })} disabled={ci === 0 || reorderCards.isPending} aria-label={t("Chuyển lên")}>▲</button>
                              <button className={tool} onClick={() => reorderCards.mutate({ gid: g.id, ids: swap(list.map((x) => x.id), ci, ci + 1) })} disabled={ci === list.length - 1 || reorderCards.isPending} aria-label={t("Chuyển xuống")}>▼</button>
                              <button className={tool} onClick={() => setCardDlg({ gid: g.id, card: c })} aria-label={t("Sửa thẻ")} title={t("Sửa thẻ")}>✏️</button>
                              <button className={`${tool} text-error-text`} onClick={() => void removeCard(c)} aria-label={t("Xóa thẻ?")} title={t("Xóa thẻ?")}>🗑</button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                    {(reorderCards.error || delCard.error) && <div className="mt-2"><ErrorBox error={reorderCards.error ?? delCard.error} /></div>}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {(reorderGroups.error || delGroup.error || renameGroup.error) && <ErrorBox error={reorderGroups.error ?? delGroup.error ?? renameGroup.error} />}

      {/* new / renamed group */}
      <Dialog open={nameDlg !== null} title={nameDlg?.gid ? t("Đổi tên nhóm") : t("Tạo nhóm")} onClose={() => setNameDlg(null)}>
        <div className="space-y-3 text-sm">
          <label className="block font-medium">{t("Tên nhóm")}
            <input className={`${inputCls} mt-1`} value={nameDlg?.value ?? ""} maxLength={60} placeholder={t("Tên nhóm mới (VD: Sân bay)")} onChange={(e) => setNameDlg((x) => (x ? { ...x, value: e.target.value } : x))}
              onKeyDown={(e) => { if (e.key === "Enter" && nameDlg?.value.trim()) { e.preventDefault(); (document.getElementById("save-group") as HTMLButtonElement | null)?.click(); } }} /></label>
          <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setNameDlg(null)}>{t("Hủy")}</Button>
            <Button id="save-group" disabled={!nameDlg?.value.trim()} onClick={() => { if (!nameDlg) return; const title = nameDlg.value.trim();
              if (nameDlg.gid) renameGroup.mutate({ gid: nameDlg.gid, title }, { onSuccess: () => setNameDlg(null) }); else addGroup.mutate({ title }, { onSuccess: () => setNameDlg(null) }); }}>{nameDlg?.gid ? t("Lưu") : t("Tạo")}</Button></div>
        </div>
      </Dialog>

      {/* name / description / icon of the set */}
      <Dialog open={info !== null} title={t("Đổi tên / mô tả")} onClose={() => setInfo(null)}>
        {info && (
          <div className="space-y-3 text-sm">
            <label className="block font-medium">{t("Tên bộ từ vựng")}<input className={`${inputCls} mt-1`} value={info.title} maxLength={80} onChange={(e) => setInfo({ ...info, title: e.target.value })} /></label>
            <label className="block font-medium">{t("Mô tả (tùy chọn)")}<textarea className={`${inputCls} mt-1 min-h-20 resize-y`} value={info.description} maxLength={300} onChange={(e) => setInfo({ ...info, description: e.target.value })} /></label>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t("Biểu tượng")}>{EMOJIS.map((e) => (
              <button key={e} role="radio" aria-checked={info.emoji === e} onClick={() => setInfo({ ...info, emoji: e })} className={`flex h-10 w-10 items-center justify-center rounded-btn border-2 text-xl ${info.emoji === e ? "border-primary bg-primary-soft" : "border-border bg-surface hover:border-primary/60"}`}>{e}</button>))}</div>
            {patchSet.error && <ErrorBox error={patchSet.error} />}
            <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setInfo(null)}>{t("Hủy")}</Button>
              <Button disabled={!info.title.trim() || patchSet.isPending} onClick={() => patchSet.mutate({ ...info, title: info.title.trim() }, { onSuccess: () => setInfo(null) })}>{t("Lưu")}</Button></div>
          </div>
        )}
      </Dialog>

      {/* publishing needs an explicit confirmation */}
      <Dialog open={publishDlg} title={t("Công khai bộ từ vựng")} onClose={() => setPublishDlg(false)}>
        <div className="space-y-3 text-sm">
          <p className="text-pretty leading-relaxed">{t("Khi công khai, mọi người dùng trong cộng đồng sẽ thấy và có thể học bộ từ “{name}”. Chỉ bạn mới được chỉnh sửa hoặc xóa bộ từ. Bạn có thể hủy công khai bất cứ lúc nào.", { name: d.title })}</p>
          {!enough && <p role="alert" className="rounded-btn bg-accent-soft p-2 text-accent-text">{t("Cần ít nhất {n} thẻ trước khi công khai (hiện có {c}).", { n: MIN_PUBLIC, c: d.card_count })}</p>}
          <label className="flex items-start gap-2"><input type="checkbox" className="mt-1" checked={agree} onChange={(e) => setAgree(e.target.checked)} /><span>{t("Tôi xác nhận muốn chia sẻ bộ từ này với cộng đồng.")}</span></label>
          {publish.error && <ErrorBox error={publish.error} />}
          <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setPublishDlg(false)}>{t("Hủy")}</Button>
            <Button disabled={!agree || !enough || publish.isPending} onClick={() => publish.mutate({ confirm: true }, { onSuccess: () => setPublishDlg(false) })}>{t("Công khai")}</Button></div>
        </div>
      </Dialog>

      {cardDlg && (
        <CardDialog key={cardDlg.card?.id ?? `new-${cardDlg.gid}`} card={cardDlg.card} groups={d.groups} groupId={cardDlg.gid} saving={addCard.isPending || editCard.isPending} error={addCard.error ?? editCard.error} onClose={() => setCardDlg(null)}
          onSave={(values, gid) => cardDlg.card ? editCard.mutate({ cid: cardDlg.card.id, values, group_id: gid }, { onSuccess: () => setCardDlg(null) }) : addCard.mutate({ gid, values }, { onSuccess: () => setCardDlg(null) })} />
      )}
    </div>
  );
}

export default function EditSetPage() {
  return <Protected><Editor /></Protected>;
}
