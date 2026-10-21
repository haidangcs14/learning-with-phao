"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n";
import { inputCls } from "@/components/ui";

export function PasswordField({ value, onChange, onBlur, placeholder, invalid, autoComplete }:
  { value: string; onChange: (v: string) => void; onBlur?: () => void; placeholder: string; invalid?: boolean; autoComplete?: string }) {
  const t = useT();
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input className={`${inputCls} pr-16 ${invalid ? "border-[#b5412a] dark:border-[#ef8a74]" : ""}`} type={show ? "text" : "password"}
        value={value} placeholder={placeholder} maxLength={128} autoComplete={autoComplete} aria-invalid={invalid}
        onChange={(e) => onChange(e.target.value)} onBlur={onBlur} />
      <button type="button" onClick={() => setShow(!show)} aria-pressed={show} aria-label={show ? t("Ẩn mật khẩu") : t("Hiện mật khẩu")}
        className="absolute inset-y-0 right-2 my-auto h-7 rounded px-2 text-xs font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
        {show ? t("Ẩn") : t("Hiện")}
      </button>
    </div>
  );
}
