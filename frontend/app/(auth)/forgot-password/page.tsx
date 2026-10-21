"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthCard, useShake } from "@/components/auth-card";
import { Checklist } from "@/components/checklist";
import { Button, inputCls } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { useT } from "@/lib/i18n";

export default function ForgotPasswordPage() {
  const t = useT();
  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState(false);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [shake, triggerShake, shakeDone] = useShake();
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!ok) { triggerShake(); return; }
    setLoading(true);
    setMessage(null);
    try {
      await apiFetch("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email: email.trim() }) });
      setSent(true);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t("Đã có lỗi xảy ra"));
      triggerShake();
    } finally { setLoading(false); }
  }

  return (
    <AuthCard title={t("Quên mật khẩu")} subtitle={t("Nhập email, chúng tôi sẽ gửi liên kết đặt lại mật khẩu.")} shake={shake} onShakeEnd={shakeDone}>
      {sent ? (
        <div className="space-y-3 text-sm">
          <p className="rounded-lg bg-green-50 p-3 text-green-800 dark:bg-green-950 dark:text-green-200">
            {t("Nếu email tồn tại trong hệ thống, liên kết đặt lại mật khẩu đã được gửi. Liên kết có hiệu lực trong 30 phút.")}
          </p>
          <p className="text-slate-500">{t("Đang chạy trên máy của bạn và chưa cấu hình SMTP? Liên kết được in trong cửa sổ terminal của backend.")}</p>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-3">
          <input className={`${inputCls} ${touched && !ok ? "border-[#b5412a] dark:border-[#ef8a74]" : ""}`} type="email" placeholder="Email" autoComplete="email"
            value={email} onChange={(e) => setEmail(e.target.value)} onBlur={() => setTouched(true)} />
          {message && <p role="alert" className="rounded-lg bg-[#b5412a]/10 p-3 text-sm text-[#9a2f1b] dark:text-[#ef8a74]">{message}</p>}
          <Button type="submit" disabled={loading} className="w-full py-2.5">{loading ? t("Đang xử lý...") : t("Gửi liên kết đặt lại")}</Button>
          <Checklist title={t("Điều kiện")} rules={[{ label: t("Email hợp lệ"), ok, touched }]} />
        </form>
      )}
      <p className="mt-5 text-center text-sm"><Link className="text-indigo-600 hover:underline" href="/login">{t("← Quay lại đăng nhập")}</Link></p>
    </AuthCard>
  );
}
