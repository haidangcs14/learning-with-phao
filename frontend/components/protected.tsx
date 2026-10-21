"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useT } from "@/lib/i18n";
import { useAuth } from "@/store/auth-store";
import { ErrorBox, Spinner } from "@/components/ui";

export function Protected({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const t = useT();
  const { user, ready } = useAuth();
  if (!ready) return <Spinner />;
  if (!user) {
    return (
      <p className="p-8 text-center">
        {t("Vui lòng")} <Link href="/login" className="text-indigo-600 underline">{t("đăng nhập")}</Link> {t("để tiếp tục.")}
      </p>
    );
  }
  if (admin && user.role !== "admin") return <div className="p-6"><ErrorBox error={new Error(t("Bạn không có quyền truy cập"))} /></div>;
  return <>{children}</>;
}
