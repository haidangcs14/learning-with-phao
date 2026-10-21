"use client";

import { useState } from "react";
import { useConfirm } from "@/components/confirm";
import { Protected } from "@/components/protected";
import { Button, Card, Empty, ErrorBox, Page, Spinner, Tabs, inputCls } from "@/components/ui";
import { useGet, useSend } from "@/hooks/api";
import { useT } from "@/lib/i18n";
import type { Brief, Friend, FriendRequest, SearchUser } from "@/types";

type Totals = Brief & { daily: number; weekly: number; monthly: number; all: number };
const PERIOD_LABEL = { daily: "Hôm nay", weekly: "Tuần", monthly: "Tháng", all: "Mọi lúc" } as const;

function Compare({ id }: { id: string }) {
  const t = useT();
  const q = useGet<{ me: Totals; friend: Totals }>(`/friends/compare/${id}`);
  if (q.isLoading) return <Spinner />;
  if (!q.data) return <ErrorBox error={q.error} />;
  const { me, friend } = q.data.data;
  return (
    <table className="mt-2 w-full text-sm">
      <thead><tr className="text-left text-slate-500"><th></th><th>{me.username} ({t("bạn")})</th><th>{friend.username}</th></tr></thead>
      <tbody>
        {(["daily", "weekly", "monthly", "all"] as const).map((p) => (
          <tr key={p}><td>{t(PERIOD_LABEL[p])}</td><td>{me[p]}</td><td>{friend[p]}</td></tr>
        ))}
      </tbody>
    </table>
  );
}

function Friends() {
  const t = useT();
  const [tab, setTab] = useState<"list" | "requests" | "search">("list");
  const [input, setInput] = useState("");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const friends = useGet<Friend[]>(tab === "list" ? "/friends" : null);
  const reqs = useGet<{ incoming: FriendRequest[]; outgoing: FriendRequest[] }>(tab === "requests" ? "/friends/requests" : null);
  const found = useGet<SearchUser[]>(tab === "search" && q.length >= 2 ? `/friends/search?q=${encodeURIComponent(q)}` : null);
  const send = useSend<unknown, string>("POST", "/friends/requests", ["/friends"], (id) => ({ user_id: id }));
  const answer = useSend<unknown, { id: string; accept: boolean }>("POST", (v) => `/friends/requests/${v.id}/${v.accept ? "accept" : "reject"}`, ["/friends"]);
  const remove = useSend<unknown, string>("DELETE", (id) => `/friends/${id}`, ["/friends"]);
  const ask = useConfirm();
  const relation: Record<string, string> = { friends: t("Đã là bạn"), pending_sent: t("Đã gửi lời mời"), pending_received: t("Đang chờ bạn chấp nhận") };

  return (
    <div className="space-y-4">
      <Tabs value={tab} onChange={setTab} options={[["list", t("Bạn bè")], ["requests", t("Lời mời")], ["search", t("Tìm người")]] as const} />
      {tab === "list" && (friends.isLoading ? <Spinner /> : (friends.data?.data.length ?? 0) === 0 ? <Empty>{t("Bạn chưa có bạn bè. Hãy tìm và kết bạn!")}</Empty> : (
        <div className="space-y-2">
          {friends.data?.data.map((f) => (
            <Card key={f.id}>
              <div className="flex items-center justify-between">
                <span className="font-medium">{f.username} <span className="text-sm text-slate-500">· {f.total_xp} XP</span></span>
                <span className="flex gap-2">
                  <Button variant="ghost" onClick={() => setOpen(open === f.id ? null : f.id)}>{t("So sánh")}</Button>
                  <Button variant="danger" onClick={async () => { if (await ask({ title: t("Xoá {name}?", { name: f.username }), message: t("Bạn sẽ không còn thấy nhau trong danh sách bạn bè."), confirmLabel: t("Xoá"), danger: true })) remove.mutate(f.id); }}>{t("Xoá")}</Button>
                </span>
              </div>
              {open === f.id && <Compare id={f.id} />}
            </Card>
          ))}
        </div>
      ))}
      {tab === "requests" && (reqs.isLoading ? <Spinner /> : (
        <div className="space-y-3">
          <h2 className="font-semibold">{t("Lời mời đến")}</h2>
          {(reqs.data?.data.incoming.length ?? 0) === 0 && <Empty>{t("Không có lời mời.")}</Empty>}
          {reqs.data?.data.incoming.map((r) => (
            <Card key={r.id} className="flex items-center justify-between">
              <span>{r.user?.username}</span>
              <span className="flex gap-2">
                <Button onClick={() => answer.mutate({ id: r.id, accept: true })}>{t("Chấp nhận")}</Button>
                <Button variant="ghost" onClick={() => answer.mutate({ id: r.id, accept: false })}>{t("Từ chối")}</Button>
              </span>
            </Card>
          ))}
          <h2 className="font-semibold">{t("Đã gửi")}</h2>
          {reqs.data?.data.outgoing.map((r) => <Card key={r.id}>{t("Đang chờ {name} chấp nhận", { name: r.user?.username ?? "" })}</Card>)}
        </div>
      ))}
      {tab === "search" && (
        <div className="space-y-3">
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setQ(input.trim()); }}>
            <input className={inputCls} placeholder={t("Nhập tên người dùng (tối thiểu 2 ký tự)")} value={input} onChange={(e) => setInput(e.target.value)} />
            <Button type="submit">{t("Tìm")}</Button>
          </form>
          {found.isLoading && <Spinner />}
          {found.data && found.data.data.length === 0 && <Empty>{t("Không tìm thấy người dùng.")}</Empty>}
          {found.data?.data.map((u) => (
            <Card key={u.id} className="flex items-center justify-between">
              <span>{u.username}</span>
              {u.relation === "none" ? <Button disabled={send.isPending} onClick={() => send.mutate(u.id, { onSuccess: () => found.refetch() })}>{t("Kết bạn")}</Button>
                : <span className="text-sm text-slate-500">{relation[u.relation]}</span>}
            </Card>
          ))}
          {send.error && <ErrorBox error={send.error} />}
        </div>
      )}
    </div>
  );
}

export default function FriendsPage() {
  const t = useT();
  return <Protected><Page title={t("Bạn bè")}><Friends /></Page></Protected>;
}
