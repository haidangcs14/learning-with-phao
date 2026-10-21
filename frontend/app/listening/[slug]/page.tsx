"use client";

import { useParams } from "next/navigation";
import { PracticeDetail } from "@/components/practice/practice-detail";

export default function Page() {
  const { slug } = useParams<{ slug: string }>();
  return <PracticeDetail kind="listening" slug={slug} />;
}
