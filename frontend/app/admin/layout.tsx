"use client";

import { Protected } from "@/components/protected";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <Protected admin>{children}</Protected>;
}
