"use client";

import { useState } from "react";
import { Avatar } from "@/components/avatar";
import { useConfirm } from "@/components/confirm";
import { Button, ErrorBox, Page, Pager, Spinner, inputCls } from "@/components/ui";
import { useGet, useSend } from "@/hooks/api";
import { useT } from "@/lib/i18n";
import { qs } from "@/lib/utils";
import { useAuth } from "@/store/auth-store";
import type { User } from "@/types";

type Row = User & { xp: number; level: number; created_at?: string };
const SIZES = [[20, "20"], [50, "50"], [100, "100"], [500, "Tất cả"]] as const;
const sel = "rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";

export default function AdminUsers() {
  const t = useT();
  const ask = useConfirm();
  const me = useAuth((s) => s.user);
  const [input, setInput] = useState("");
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [limit, setLimit] = useState(50);
  const [page, setPage] = useState(1);
  const users = useGet<Row[]>(`/admin/users?${qs({ q, role, page, limit })}`);
  const patch = useSend<unknown, { id: string; role?: string; is_active?: boolean }>("PATCH", (v) => `/admin/users/${v.id}`, ["/admin/users"], (v) => ({ role: v.role, is_active: v.is_active }));
  const del = useSend<unknown, string>("DELETE", (id) => `/admin/users/${id}`, ["/admin/users"]);
  return (
    <Page title={t("Quản lý người dùng")}>
      <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); setQ(input); setPage(1); }}>
        <input className={`${inputCls} sm:max-w-xs`} placeholder={t("Tìm email / username")} value={input} onChange={(e) => setInput(e.target.value)} />
        <select className={sel} value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }} aria-label={t("Vai trò")}>
          <option value="">{t("Mọi vai trò")}</option><option value="user">user</option><option value="admin">admin</option>
        </select>
        <select className={sel} value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }} aria-label={t("Số dòng mỗi trang")}>
          {SIZES.map(([n, label]) => <option key={n} value={n}>{label === "Tất cả" ? t("Tất cả") : label}</option>)}
        </select>
        <Button type="submit">{t("Tìm")}</Button>
        {users.data?.meta && <span className="ml-auto text-sm text-slate-500">{t("Tổng: {n} người dùng", { n: users.data.meta.total })}</span>}
      </form>
      {(patch.error || del.error) && <ErrorBox error={patch.error ?? del.error} />}
      {users.isLoading ? <Spinner /> : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-slate-500"><tr><th className="p-2">{t("Người dùng")}</th><th>Email</th><th>{t("Vai trò")}</th><th>{t("Cấp độ")}</th><th>{t("Ngày tham gia")}</th><th>{t("Trạng thái")}</th><th></th></tr></thead>
            <tbody>
              {users.data?.data.map((u) => {
                const self = u.id === me?.id;
                return (
                  <tr key={u.id} className="border-t border-slate-200 dark:border-slate-800">
                    <td className="p-2"><span className="flex items-center gap-2"><Avatar user={u} size={28} /><span><b>{u.username}</b>{u.full_name && <span className="block text-xs text-slate-500">{u.full_name}</span>}</span></span></td>
                    <td>{u.email}</td>
                    <td><select disabled={self} className={sel} value={u.role} onChange={(e) => patch.mutate({ id: u.id, role: e.target.value })}><option>user</option><option>admin</option></select></td>
                    <td>{u.role === "admin" ? "–" : <span><b>Lv.{u.level}</b> <span className="text-xs text-slate-500">· {u.xp} XP</span></span>}</td>
                    <td className="whitespace-nowrap">{u.created_at ? new Date(u.created_at).toLocaleDateString() : "–"}</td>
                    <td><Button variant="ghost" disabled={self} onClick={() => patch.mutate({ id: u.id, is_active: !u.is_active })}>{u.is_active ? t("Hoạt động") : t("Đã khoá")}</Button></td>
                    <td><Button variant="danger" disabled={self}
                      onClick={async () => { if (await ask({ title: t("Xoá {name}?", { name: u.username }), message: t("Tài khoản này sẽ bị xoá vĩnh viễn."), confirmLabel: t("Xoá"), danger: true })) del.mutate(u.id); }}>{t("Xoá")}</Button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pager meta={users.data?.meta} onPage={setPage} />
    </Page>
  );
}
