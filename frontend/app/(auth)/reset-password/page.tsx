"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AuthCard, useShake } from "@/components/auth-card";
import { Checklist } from "@/components/checklist";
import { PasswordField } from "@/components/password-field";
import { Button } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { useT } from "@/lib/i18n";

export default function ResetPasswordPage() {
  const t = useT();
  const [token, setToken] = useState("");
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [shake, triggerShake, shakeDone] = useShake();
  useEffect(() => { setToken(new URLSearchParams(window.location.search).get("token") ?? ""); }, []);

  const lenOk = pw.length >= 8, letterOk = /[A-Za-z]/.test(pw), digitOk = /\d/.test(pw), matchOk = confirm.length > 0 && confirm === pw;
  const touchedPw = attempted || pw.length > 0;
  const rules = [
    { label: t("Mật khẩu có ít nhất 8 ký tự"), ok: lenOk, touched: touchedPw },
    { label: t("Mật khẩu có ít nhất 1 chữ cái"), ok: letterOk, touched: touchedPw },
    { label: t("Mật khẩu có ít nhất 1 chữ số"), ok: digitOk, touched: touchedPw },
    { label: t("Mật khẩu nhập lại trùng khớp"), ok: matchOk, touched: attempted || confirm.length > 0 },
  ];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setAttempted(true);
    setMessage(null);
    if (!token) { setMessage(t("Liên kết không hợp lệ hoặc đã hết hạn.")); triggerShake(); return; }
    if (!rules.every((r) => r.ok)) { triggerShake(); return; }
    setLoading(true);
    try {
      await apiFetch("/auth/reset-password", { method: "POST", body: JSON.stringify({ token, new_password: pw }) });
      setDone(true);
    } catch {
      setMessage(t("Liên kết không hợp lệ hoặc đã hết hạn."));
      triggerShake();
    } finally { setLoading(false); }
  }

  return (
    <AuthCard title={t("Đặt lại mật khẩu")} subtitle={t("Chọn mật khẩu mới cho tài khoản của bạn.")} shake={shake} onShakeEnd={shakeDone}>
      {done ? (
        <div className="space-y-3 text-center">
          <p className="rounded-lg bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950 dark:text-green-200">{t("Đã đổi mật khẩu. Bạn có thể đăng nhập bằng mật khẩu mới.")}</p>
          <Link href="/login" className="inline-block rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700">{t("Đăng nhập")}</Link>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-3">
          <PasswordField value={pw} onChange={setPw} placeholder={t("Mật khẩu mới")} autoComplete="new-password" invalid={touchedPw && !(lenOk && letterOk && digitOk)} />
          <PasswordField value={confirm} onChange={setConfirm} placeholder={t("Nhập lại mật khẩu")} autoComplete="new-password" invalid={(attempted || confirm.length > 0) && !matchOk} />
          {message && (
            <p role="alert" className="rounded-lg bg-[#b5412a]/10 p-3 text-sm text-[#9a2f1b] dark:text-[#ef8a74]">
              {message} <Link className="underline" href="/forgot-password">{t("Gửi lại liên kết")}</Link>
            </p>
          )}
          <Button type="submit" disabled={loading} className="w-full py-2.5">{loading ? t("Đang xử lý...") : t("Đổi mật khẩu")}</Button>
          <Checklist title={t("Điều kiện")} rules={rules} />
        </form>
      )}
    </AuthCard>
  );
}
