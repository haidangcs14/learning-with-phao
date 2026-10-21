"use client";

import { useState } from "react";
import { useConfirm } from "@/components/confirm";
import { Button, ErrorBox, Page, Pager, Spinner, inputCls } from "@/components/ui";
import { useGet, useSend } from "@/hooks/api";
import { useT } from "@/lib/i18n";
import { qs } from "@/lib/utils";
import { useAuth } from "@/store/auth-store";
import type { User } from "@/types";

export default function AdminUsers() {
  const t = useT();
  const ask = useConfirm();
  const me = useAuth((s) => s.user);
  const [input, setInput] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const users = useGet<User[]>(`/admin/users?${qs({ q, page, limit: 15 })}`);
  const patch = useSend<unknown, { id: string; role?: string; is_active?: boolean }>(
    "PATCH", (v) => `/admin/users/${v.id}`, ["/admin/users"], (v) => ({ role: v.role, is_active: v.is_active }));
  const del = useSend<unknown, string>("DELETE", (id) => `/admin/users/${id}`, ["/admin/users"]);
  return (
    <Page title={t("Quản lý người dùng")}>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setQ(input); setPage(1); }}>
        <input className={`${inputCls} sm:max-w-xs`} placeholder={t("Tìm email / username")} value={input} onChange={(e) => setInput(e.target.value)} />
        <Button type="submit">{t("Tìm")}</Button>
      </form>
      {(patch.error || del.error) && <ErrorBox error={patch.error ?? del.error} />}
      {users.isLoading ? <Spinner /> : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-slate-500"><tr><th className="p-2">Username</th><th>Email</th><th>{t("Vai trò")}</th><th>{t("Trạng thái")}</th><th></th></tr></thead>
            <tbody>
              {users.data?.data.map((u) => {
                const self = u.id === me?.id;
                return (
                  <tr key={u.id} className="border-t border-slate-200 dark:border-slate-800">
                    <td className="p-2">{u.username}</td><td>{u.email}</td>
                    <td><select disabled={self} className="rounded border border-slate-300 bg-white p-1 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" value={u.role} onChange={(e) => patch.mutate({ id: u.id, role: e.target.value })}><option>user</option><option>admin</option></select></td>
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
