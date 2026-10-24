"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

/** Goes back to exactly where the user was (same filters, page and scroll). Falls back to `href` when the page was opened directly. */
export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  const router = useRouter();
  return (
    <Link href={href} className="text-sm text-indigo-600"
      onClick={(e) => { if (window.history.length > 1) { e.preventDefault(); router.back(); } }}>
      {children}
    </Link>
  );
}
