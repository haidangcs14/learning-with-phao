"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { API_URL, ApiError, apiFetch } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { useAuth } from "@/store/auth-store";
import type { User } from "@/types";
import { AuthCard, useShake } from "@/components/auth-card";
import { Checklist, type Rule } from "@/components/checklist";
import { PasswordField } from "@/components/password-field";
import { Button, inputCls } from "@/components/ui";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const URL_ERRORS: Record<string, string> = {
  oauth_not_configured: "Đăng nhập bằng mạng xã hội chưa được cấu hình trên máy chủ.",
  oauth_failed: "Đăng nhập bằng mạng xã hội thất bại. Vui lòng thử lại.",
  oauth_state: "Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng thử lại.",
  oauth_email_taken: "Email này đã đăng ký bằng mật khẩu. Hãy đăng nhập bằng email và mật khẩu.",
  oauth_no_email: "Nhà cung cấp không trả về địa chỉ email.",
};
const API_ERRORS: Record<string, string> = {
  INVALID_CREDENTIALS: "Email hoặc mật khẩu không đúng.", EMAIL_TAKEN: "Email này đã được đăng ký.",
  USERNAME_TAKEN: "Tên người dùng đã tồn tại.", USER_INACTIVE: "Tài khoản đã bị khoá.", VALIDATION_ERROR: "Thông tin chưa hợp lệ.",
};

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.7-.4-3.9z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.7-.4-3.9z" />
    </svg>
  );
}
function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path fill="#1877F2" d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z" />
    </svg>
  );
}

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const t = useT();
  const router = useRouter();
  const setSession = useAuth((s) => s.setSession);
  const isLogin = mode === "login";
  const [form, setForm] = useState({ email: "", username: "", password: "", confirm: "" });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [attempted, setAttempted] = useState(false);
  const [remember, setRemember] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [shake, triggerShake, shakeDone] = useShake();

  useEffect(() => {
    const err = new URLSearchParams(window.location.search).get("error");
    if (err && URL_ERRORS[err]) { setMessage(t(URL_ERRORS[err] as string)); triggerShake(); }
    if (isLogin) { // "remember me" also pre-fills the last used email
      try { const saved = localStorage.getItem("remember_email"); if (saved) setForm((f) => ({ ...f, email: saved })); } catch { /* storage blocked */ }
    }
  }, [isLogin, triggerShake]);

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const touch = (k: string) => () => setTouched((x) => ({ ...x, [k]: true }));
  const show = (field: string) => attempted || !!touched[field];

  const emailOk = EMAIL_RE.test(form.email.trim());
  const userOk = /^[A-Za-z0-9_]{3,30}$/.test(form.username);
  const lenOk = form.password.length >= 8;
  const letterOk = /[A-Za-z]/.test(form.password);
  const digitOk = /\d/.test(form.password);
  const matchOk = form.confirm.length > 0 && form.confirm === form.password;
  const rules: Rule[] = isLogin ? [
    { label: t("Email hợp lệ"), ok: emailOk, touched: show("email") },
    { label: t("Đã nhập mật khẩu"), ok: form.password.length > 0, touched: show("password") },
  ] : [
    { label: t("Email hợp lệ"), ok: emailOk, touched: show("email") },
    { label: t("Tên người dùng 3-30 ký tự (chữ, số, _)"), ok: userOk, touched: show("username") },
    { label: t("Mật khẩu có ít nhất 8 ký tự"), ok: lenOk, touched: show("password") },
    { label: t("Mật khẩu có ít nhất 1 chữ cái"), ok: letterOk, touched: show("password") },
    { label: t("Mật khẩu có ít nhất 1 chữ số"), ok: digitOk, touched: show("password") },
    { label: t("Mật khẩu nhập lại trùng khớp"), ok: matchOk, touched: show("confirm") },
  ];
  const allOk = rules.every((r) => r.ok);
  const bad = (field: string, ok: boolean) => show(field) && !ok;
  const red = "border-[#b5412a] dark:border-[#ef8a74]";

  function social(provider: "google" | "facebook") {
    window.location.href = `${API_URL}/auth/${provider}/login`; // full-page redirect: the secrets stay on the server
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setAttempted(true);
    if (!allOk) { triggerShake(); return; }
    setLoading(true);
    try {
      const email = form.email.trim();
      if (!isLogin) await apiFetch("/auth/register", { method: "POST", body: JSON.stringify({ email, username: form.username, password: form.password }) });
      const r = await apiFetch<{ access_token: string; user: User }>("/auth/login", {
        method: "POST", body: JSON.stringify({ email, password: form.password, remember: isLogin ? remember : true }),
      });
      try { if (isLogin && !remember) localStorage.removeItem("remember_email"); else localStorage.setItem("remember_email", email); } catch { /* ignore */ }
      setSession(r.data.access_token, r.data.user);
      router.push("/dashboard");
    } catch (err) {
      const known = err instanceof ApiError ? API_ERRORS[err.errorCode] : undefined;
      setMessage(known ? t(known) : err instanceof Error ? err.message : t("Đã có lỗi xảy ra"));
      triggerShake();
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard title={isLogin ? t("Đăng nhập") : t("Tạo tài khoản")} shake={shake} onShakeEnd={shakeDone}
      subtitle={isLogin ? t("Chào mừng bạn quay lại!") : t("Miễn phí và chỉ mất vài giây.")}>
      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={() => social("google")} className="flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800">
          <GoogleIcon /> Google
        </button>
        <button type="button" onClick={() => social("facebook")} className="flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800">
          <FacebookIcon /> Facebook
        </button>
      </div>
      <div className="my-5 flex items-center gap-3 text-xs uppercase text-slate-400">
        <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />{t("hoặc")}<span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
      </div>

      <form onSubmit={submit} noValidate className="space-y-3">
        <input className={`${inputCls} ${bad("email", emailOk) ? red : ""}`} type="email" placeholder="Email" autoComplete="email" aria-invalid={bad("email", emailOk)}
          value={form.email} onChange={(e) => set("email")(e.target.value)} onBlur={touch("email")} />
        {!isLogin && (
          <input className={`${inputCls} ${bad("username", userOk) ? red : ""}`} placeholder={t("Tên người dùng")} autoComplete="username" maxLength={30} aria-invalid={bad("username", userOk)}
            value={form.username} onChange={(e) => set("username")(e.target.value)} onBlur={touch("username")} />
        )}
        <PasswordField value={form.password} onChange={set("password")} onBlur={touch("password")} placeholder={t("Mật khẩu")}
          autoComplete={isLogin ? "current-password" : "new-password"}
          invalid={isLogin ? bad("password", form.password.length > 0) : bad("password", lenOk && letterOk && digitOk)} />
        {!isLogin && <PasswordField value={form.confirm} onChange={set("confirm")} onBlur={touch("confirm")} placeholder={t("Nhập lại mật khẩu")}
          autoComplete="new-password" invalid={bad("confirm", matchOk)} />}

        {isLogin && (
          <div className="flex items-center justify-between text-sm">
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 accent-indigo-600" />
              {t("Ghi nhớ tài khoản")}
            </label>
            <Link href="/forgot-password" className="text-indigo-600 hover:underline">{t("Quên mật khẩu?")}</Link>
          </div>
        )}

        {message && <p role="alert" className="rounded-lg border border-[#b5412a]/40 bg-[#b5412a]/10 p-3 text-sm text-[#9a2f1b] dark:border-[#ef8a74]/40 dark:bg-[#ef8a74]/10 dark:text-[#ef8a74]">{message}</p>}
        <Button type="submit" disabled={loading} className="w-full py-2.5">{loading ? t("Đang xử lý...") : isLogin ? t("Đăng nhập") : t("Đăng ký")}</Button>
      </form>

      <div className="mt-4"><Checklist title={t("Điều kiện")} rules={rules} /></div>

      <p className="mt-5 text-center text-sm text-slate-500">
        {isLogin ? t("Chưa có tài khoản?") : t("Đã có tài khoản?")}{" "}
        <Link className="font-medium text-indigo-600 hover:underline" href={isLogin ? "/register" : "/login"}>{isLogin ? t("Đăng ký") : t("Đăng nhập")}</Link>
      </p>
    </AuthCard>
  );
}
