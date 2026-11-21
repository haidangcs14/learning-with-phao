"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useGet, useSend } from "@/hooks/api";
import { useT } from "@/lib/i18n";

interface Notif { id: string; type: string; params: Record<string, string | number>; link: string; read: boolean; created_at: string }
interface Feed { items: Notif[]; unread: number }
type T = ReturnType<typeof useT>;

/** The server stores a type and its parameters; the text is built here, so it follows the language the user picked. */
function describe(n: Notif, t: T): { icon: string; title: string; body: string } {
  const p = n.params;
  switch (n.type) {
    case "level_up": return { icon: "🎉", title: t("Bạn đã lên cấp {n}!", { n: Number(p.level) }), body: t("Tiếp tục học để lên cấp cao hơn nhé.") };
    case "friend_request": return { icon: "👋", title: t("{name} đã gửi cho bạn lời mời kết bạn", { name: String(p.name ?? "") }), body: t("Bấm để xem và trả lời.") };
    case "friend_accepted": return { icon: "🤝", title: t("{name} đã chấp nhận lời mời kết bạn của bạn", { name: String(p.name ?? "") }), body: "" };
    case "report_resolved": return { icon: "✅", title: t("Báo lỗi của bạn đã được xử lý"), body: String(p.title ?? "") };
    case "announcement": return { icon: "📢", title: String(p.title ?? ""), body: String(p.body ?? "") };
    default: return { icon: "🔔", title: t("Thông báo mới"), body: "" };
  }
}

function ago(iso: string, t: T): string {
  const s = Math.max(0, (Date.now() - new Date(iso.endsWith("Z") ? iso : `${iso}Z`).getTime()) / 1000);
  if (s < 60) return t("Vừa xong");
  if (s < 3600) return t("{n} phút trước", { n: Math.floor(s / 60) });
  if (s < 86400) return t("{n} giờ trước", { n: Math.floor(s / 3600) });
  return t("{n} ngày trước", { n: Math.floor(s / 86400) });
}

/** Bell in the navbar. The panel opens right below it. The count refreshes every minute and when the tab gets focus again. */
export function NotificationBell() {
  const t = useT();
  const router = useRouter();
  const feed = useGet<Feed>("/notifications?limit=20", { refetchInterval: 60_000, refetchOnWindowFocus: true });
  const markRead = useSend<unknown, string>("POST", (id) => `/notifications/${id}/read`, ["/notifications"]);
  const markAll = useSend("POST", "/notifications/read-all", ["/notifications"]);
  const remove = useSend<unknown, string>("DELETE", (id) => `/notifications/${id}`, ["/notifications"]);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const items = feed.data?.data.items ?? [];
  const unread = feed.data?.data.unread ?? 0;

  useEffect(() => {
    if (!open) return;
    void feed.refetch();
    const onDown = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  function openItem(n: Notif) {
    if (!n.read) markRead.mutate(n.id);
    setOpen(false);
    if (n.link) router.push(n.link);
  }

  return (
    <div ref={box} className="relative">
      <button onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="dialog" title={t("Thông báo")}
        aria-label={unread > 0 ? t("Thông báo ({n} chưa đọc)", { n: unread }) : t("Thông báo")}
        className={`relative flex h-9 w-9 items-center justify-center rounded-btn text-foreground hover:bg-surface-secondary ${open ? "bg-surface-secondary" : ""}`}>
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {unread > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 text-[10px] font-bold leading-none text-error-foreground">{unread > 9 ? "9+" : unread}</span>}
      </button>

      {open && (
        <div role="dialog" aria-label={t("Thông báo")}
          className="fixed inset-x-3 top-[4.75rem] z-50 overflow-hidden rounded-card border border-border bg-surface text-foreground shadow-hover sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[24rem]">
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
            <h2 className="text-base font-bold">{t("Thông báo")}</h2>
            <button onClick={() => markAll.mutate()} disabled={unread === 0 || markAll.isPending} className="rounded-btn px-2 py-1 text-xs font-semibold text-primary-text hover:bg-primary-soft disabled:cursor-not-allowed disabled:opacity-40">{t("Đánh dấu đã đọc tất cả")}</button>
          </div>
          <div className="max-h-[min(24rem,70vh)] overflow-y-auto">
            {feed.isLoading ? <p className="p-6 text-center text-sm text-muted-foreground">{t("Đang tải...")}</p>
              : items.length === 0 ? (
                <div className="p-8 text-center"><p className="text-3xl" aria-hidden="true">🔔</p><p className="mt-1 text-sm text-muted-foreground">{t("Chưa có thông báo nào.")}</p></div>
              ) : (
                <ul className="divide-y divide-border">
                  {items.map((n) => {
                    const d = describe(n, t);
                    return (
                      <li key={n.id} className={`group flex items-start gap-1 ${n.read ? "" : "bg-primary-soft/40"}`}>
                        <button onClick={() => openItem(n)} className="flex min-w-0 flex-1 items-start gap-3 px-4 py-3 text-left hover:bg-surface-secondary">
                          <span className="mt-0.5 text-xl" aria-hidden="true">{d.icon}</span>
                          <span className="min-w-0 flex-1">
                            <span className={`block text-sm ${n.read ? "font-medium" : "font-bold"}`}>{d.title}</span>
                            {d.body && <span className="line-clamp-2 block text-sm text-muted-foreground">{d.body}</span>}
                            <span className="mt-0.5 block text-xs text-muted-foreground">{ago(n.created_at, t)}</span>
                          </span>
                          {!n.read && <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" aria-label={t("Chưa đọc")} />}
                        </button>
                        <button onClick={() => remove.mutate(n.id)} aria-label={t("Xóa thông báo")} title={t("Xóa thông báo")}
                          className="mr-2 mt-2 rounded-btn px-2 py-1 text-sm text-muted-foreground opacity-60 hover:bg-surface-secondary hover:text-error-text hover:opacity-100 focus-visible:opacity-100 group-hover:opacity-100">✕</button>
                      </li>
                    );
                  })}
                </ul>
              )}
          </div>
        </div>
      )}
    </div>
  );
}
