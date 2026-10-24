"use client";

import { useRef, useState } from "react";
import { Avatar } from "@/components/avatar";
import { Checklist } from "@/components/checklist";
import { PasswordField } from "@/components/password-field";
import { Protected } from "@/components/protected";
import { Button, Card, ErrorBox, Page, inputCls } from "@/components/ui";
import { useGet, useSend } from "@/hooks/api";
import { useT } from "@/lib/i18n";
import { useAuth } from "@/store/auth-store";
import type { User } from "@/types";

function Profile() {
  const t = useT();
  const user = useAuth((s) => s.user) as User;
  const setUser = useAuth((s) => s.setUser);
  const isAdmin = user.role === "admin";
  const xp = useGet<{ total_xp: number; level: number; xp_into_level: number; xp_for_next: number }>(isAdmin ? null : "/leaderboard/me");
  const [form, setForm] = useState({ full_name: user.full_name ?? "", username: user.username });
  const save = useSend<User, { full_name: string; username: string }>("PATCH", "/users/me");
  const upload = useSend<User, FormData>("POST", "/users/me/avatar");
  const remove = useSend<User>("DELETE", "/users/me/avatar");
  const file = useRef<HTMLInputElement>(null);
  const [saved, setSaved] = useState(false);

  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwTried, setPwTried] = useState(false);
  const change = useSend<unknown, { current_password: string; new_password: string }>("POST", "/auth/change-password");
  const lenOk = pw.next.length >= 8, letterOk = /[A-Za-z]/.test(pw.next), digitOk = /\d/.test(pw.next), matchOk = pw.confirm.length > 0 && pw.confirm === pw.next;
  const showPw = pwTried || pw.next.length > 0;
  const rules = [
    { label: t("Mật khẩu có ít nhất 8 ký tự"), ok: lenOk, touched: showPw }, { label: t("Mật khẩu có ít nhất 1 chữ cái"), ok: letterOk, touched: showPw },
    { label: t("Mật khẩu có ít nhất 1 chữ số"), ok: digitOk, touched: showPw }, { label: t("Mật khẩu nhập lại trùng khớp"), ok: matchOk, touched: pwTried || pw.confirm.length > 0 },
  ];

  const pct = xp.data ? Math.round((xp.data.data.xp_into_level / xp.data.data.xp_for_next) * 100) : 0;
  return (
    <Page title={t("Hồ sơ cá nhân")}>
      <Card className="flex flex-col items-center gap-4 sm:flex-row">
        <div className="flex flex-col items-center gap-2">
          <Avatar user={user} size={96} />
          {!isAdmin && xp.data && <span className="rounded-full bg-indigo-600 px-3 py-0.5 text-sm font-bold text-white">Lv.{xp.data.data.level}</span>}
        </div>
        <div className="w-full flex-1 space-y-2">
          <p className="text-xl font-semibold">{user.full_name || user.username}</p>
          <p className="text-sm text-slate-500">@{user.username} · {user.email}</p>
          {!isAdmin && xp.data && (
            <div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"><div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${pct}%` }} /></div>
              <p className="mt-1 text-xs text-slate-500">{t("{a}/{b} XP đến cấp tiếp theo", { a: xp.data.data.xp_into_level, b: xp.data.data.xp_for_next })} · {t("Tổng XP")}: {xp.data.data.total_xp}</p>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <input ref={file} type="file" accept="image/png,image/jpeg,image/webp" hidden
              onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; const fd = new FormData(); fd.append("file", f); upload.mutate(fd, { onSuccess: (r) => setUser(r.data) }); e.target.value = ""; }} />
            <Button variant="ghost" disabled={upload.isPending} onClick={() => file.current?.click()}>{t("Đổi ảnh đại diện")}</Button>
            {user.avatar_url && <Button variant="ghost" disabled={remove.isPending} onClick={() => remove.mutate(undefined, { onSuccess: (r) => setUser(r.data) })}>{t("Xoá ảnh")}</Button>}
          </div>
          <p className="text-xs text-slate-500">{t("Ảnh PNG, JPEG hoặc WebP, tối đa 2MB.")}</p>
          {(upload.error || remove.error) && <ErrorBox error={upload.error ?? remove.error} />}
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold">{t("Thông tin cá nhân")}</h2>
        <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); setSaved(false); save.mutate(form, { onSuccess: (r) => { setUser(r.data); setSaved(true); } }); }}>
          <label className="text-sm">{t("Họ và tên")}<input className={inputCls} value={form.full_name} maxLength={100} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></label>
          <label className="text-sm">{t("Tên người dùng")}<input className={inputCls} value={form.username} pattern="[A-Za-z0-9_]{3,30}" required onChange={(e) => setForm({ ...form, username: e.target.value })} /></label>
          <label className="text-sm sm:col-span-2">{t("Email (không thể thay đổi)")}<input className={`${inputCls} opacity-60`} value={user.email} disabled /></label>
          {save.error && <div className="sm:col-span-2"><ErrorBox error={save.error} /></div>}
          {saved && <p className="text-sm text-green-600 sm:col-span-2">✓ {t("Đã lưu thay đổi.")}</p>}
          <Button type="submit" disabled={save.isPending} className="sm:col-span-2 sm:w-fit">{t("Lưu thay đổi")}</Button>
        </form>
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold">{t("Đổi mật khẩu")}</h2>
        <form className="max-w-md space-y-3" noValidate onSubmit={(e) => {
          e.preventDefault(); setPwTried(true);
          if (!pw.current || !rules.every((r) => r.ok)) return;
          change.mutate({ current_password: pw.current, new_password: pw.next }, { onSuccess: () => { setPw({ current: "", next: "", confirm: "" }); setPwTried(false); } });
        }}>
          <PasswordField value={pw.current} onChange={(v) => setPw({ ...pw, current: v })} placeholder={t("Mật khẩu hiện tại")} autoComplete="current-password" invalid={pwTried && !pw.current} />
          <PasswordField value={pw.next} onChange={(v) => setPw({ ...pw, next: v })} placeholder={t("Mật khẩu mới")} autoComplete="new-password" invalid={showPw && !(lenOk && letterOk && digitOk)} />
          <PasswordField value={pw.confirm} onChange={(v) => setPw({ ...pw, confirm: v })} placeholder={t("Nhập lại mật khẩu")} autoComplete="new-password" invalid={(pwTried || pw.confirm.length > 0) && !matchOk} />
          <Checklist title={t("Điều kiện")} rules={rules} />
          {change.error && <ErrorBox error={change.error} />}
          {change.isSuccess && <p className="text-sm text-green-600">✓ {t("Đã đổi mật khẩu. Các thiết bị khác sẽ cần đăng nhập lại.")}</p>}
          <Button type="submit" disabled={change.isPending}>{t("Đổi mật khẩu")}</Button>
        </form>
      </Card>
    </Page>
  );
}

export default function ProfilePage() {
  return <Protected><Profile /></Protected>;
}
