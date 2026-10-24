"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useT } from "@/lib/i18n";
import { useAuth } from "@/store/auth-store";
import { ErrorBox, Spinner } from "@/components/ui";

export function Protected({
  children,
  admin = false,
}: {
  children: ReactNode;
  admin?: boolean;
}) {
  const t = useT();
  const { user, ready } = useAuth();
  if (!ready) return <Spinner />;

  if (!user) {
    return (
      <div className="pt-20 items-center justify-center">
        <div className="hover-shake mx-auto flex min-h-[300px] w-full max-w-xs items-center justify-center rounded-2xl border border-[#2b3552] px-4 py-8 shadow-[0_8px_30px_rgba(0,0,0,0.18)] dark:shadow-[0_8px_30px_rgba(255,255,255,0.08)]">
          <div className="flex max-w-md flex-col items-center text-center">
            <img
              src="/cute.gif"
              alt="Minh họa yêu cầu đăng nhập"
              className="h-40 w-40 object-contain"
            />

            <h2 className="mb-3 text-xl font-bold text-foreground">
              {t("Yêu cầu Đăng nhập")}
            </h2>

            <p className="mb-5 text-base text-[#3998e8]">
              {t("Bạn cần đăng nhập để học từ vựng")}
            </p>

            <Link
              href="/login"
              className="rounded-full bg-[#3998d6] px-6 py-3 font-semibold text-white transition-colors hover:bg-[#2585c4]"
            >
              {t("Đăng nhập")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (admin && user.role !== "admin")
    return (
      <div className="p-6">
        <ErrorBox error={new Error(t("Bạn không có quyền truy cập"))} />
      </div>
    );
  return <>{children}</>;
}
