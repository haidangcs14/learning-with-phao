"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import type { HeroKey } from "@/components/keyboard-hero";
import { useT } from "@/lib/i18n";
import { useAuth } from "@/store/auth-store";
import { useLang } from "@/store/lang-store";

const KeyboardHero = dynamic(() => import("@/components/keyboard-hero"), { ssr: false });

// [label on the key, sub-label, description (shown on hover), colour, link]
const DEFS = [
  ["Hello", "Giao tiếp", "Mẫu câu giao tiếp hằng ngày theo chủ đề, có phát âm.", "#10b981", "/sentences"],
  ["Aa", "Từ vựng", "Học từ theo cấp độ, nghe phát âm, lưu yêu thích.", "#06b6d4", "/vocabulary"],
  ["Gr", "Ngữ pháp", "12 thì và các cấu trúc quan trọng, có công thức và bài tập.", "#fbbf24", "/grammar"],
  ["IPA", "Phát âm", "Bảng 44 âm IPA kèm cách đặt lưỡi, từ ví dụ và video.", "#059669", "/ipa"],
  ["Cards", "Flashcard", "Ôn từ vựng bằng thẻ lật theo lịch lặp lại ngắt quãng.", "#0891b2", "/flashcards"],
  ["Speak", "Nói", "Ghi âm theo chủ đề, xem sóng âm và lưu lại bài nói.", "#f59e0b", "/speaking"],
  ["Listen", "Nghe", "Nghe hội thoại và bài nói theo cấp độ, rồi trả lời câu hỏi.", "#34d399", "/listening"],
  ["Read", "Đọc", "Bài đọc từ A1 đến C1 kèm từ vựng và câu hỏi trắc nghiệm.", "#22d3ee", "/reading"],
  ["Write", "Viết", "Viết đoạn văn theo đề, AI chấm điểm và sửa lỗi.", "#10b981", "/writing"],
  ["Exam", "Kiểm tra", "Làm bài kiểm tra có tính giờ do giáo viên tải lên.", "#06b6d4", "/exams"],
  ["Quiz", "Trắc nghiệm", "Làm bài trắc nghiệm nhanh, đúng sai hiện rõ màu sắc.", "#fbbf24", "/quiz"],
  ["Match", "Lật thẻ", "Trò chơi lật thẻ ghi nhớ cặp từ - nghĩa, tính điểm cao nhất.", "#059669", "/games/matching"],
  ["Fill", "Điền từ", "Chọn từ đúng điền vào chỗ trống trong câu.", "#0891b2", "/games/fill-blank"],
  ["Verb", "Động từ BQT", "Bảng động từ bất quy tắc, có chế độ tự kiểm tra.", "#f59e0b", "/irregular-verbs"],
  ["Chat", "Trợ lý AI", "Hỏi đáp ngữ pháp, từ vựng với trợ lý tiếng Anh.", "#2563eb", "#chat"],
  ["Rank", "Xếp hạng", "Xem bạn đứng ở đâu trên bảng xếp hạng XP.", "#34d399", "/leaderboard"],
  ["Friends", "Bạn bè", "Kết bạn và so sánh mức độ chăm chỉ.", "#22d3ee", "/friends"],
  ["Daily", "Tổng quan", "Xem XP, chuỗi ngày học và biểu đồ chăm chỉ.", "#10b981", "/dashboard"],
  ["Start", "Tham gia", "Tạo tài khoản miễn phí và bắt đầu học ngay.", "#9333ea", "#start"],
] as const;

export function HomeHero() {
  const t = useT();
  const lang = useLang((s) => s.lang);
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const [hovered, setHovered] = useState<HeroKey | null>(null);

  // memoised: changing `keys` rebuilds the 3D scene, so only rebuild when the language changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const keys = useMemo<HeroKey[]>(() => DEFS.map(([label, sub, desc, color, href]) => ({ label, sub: t(sub), desc: t(desc), color, href })), [lang]);

  const onKeyClick = useCallback((k: HeroKey) => {
    if (!k.href) return;
    if (k.href === "#chat") window.dispatchEvent(new Event("open-chat"));
    else if (k.href === "#start") router.push(user ? "/dashboard" : "/register");
    else router.push(k.href);
  }, [router, user]);

  return (
    <section className="relative isolate h-[calc(100svh-5rem)] min-h-[620px] overflow-hidden bg-gradient-to-br from-background via-primary-soft to-secondary-soft text-foreground">
      <KeyboardHero keys={keys} onKeyClick={onKeyClick} onKeyHover={setHovered} catSrc="/cute.gif" />
      <div className="pointer-events-none relative z-10 mx-auto flex h-full max-w-6xl flex-col px-6 pt-8 lg:justify-center lg:pt-0">
        <div className="max-w-md space-y-5">
          <p className="inline-block rounded-full border border-border bg-surface/70 px-3 py-1 text-xs font-medium text-primary-text backdrop-blur">{t("Miễn phí cho người Việt")}</p>
          <h1 className="text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
            Học cùng <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Phao</span>
          </h1>
          <p className="text-lg text-foreground/90">{t("Học tiếng Anh mỗi ngày")}</p>
          <p className="hidden text-sm text-muted-foreground sm:block">{t("Bấm vào các phím trên bàn phím 3D để chọn kỹ năng bạn muốn luyện.")}</p>
          <div className="pointer-events-auto flex flex-wrap gap-3">
            <Link href={user ? "/dashboard" : "/register"} className="lift rounded-btn bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-raised hover:bg-primary-hover">
              {user ? t("Tiếp tục học →") : t("Bắt đầu học")}
            </Link>
            {!user && <Link href="/login" className="rounded-btn border border-input bg-surface px-5 py-2.5 text-sm font-semibold text-foreground shadow-soft hover:bg-surface-secondary">{t("Đăng nhập")}</Link>}
          </div>
          <div className="min-h-[92px] rounded-card border border-border bg-surface/80 p-4 text-sm shadow-soft backdrop-blur" aria-live="polite">
            {hovered ? (
              <>
                <p className="font-semibold" style={{ color: hovered.color }}>{hovered.label} · {hovered.sub}</p>
                <p className="mt-1 text-foreground">{hovered.desc}</p>
              </>
            ) : <p className="text-muted-foreground">{t("Di chuột hoặc chạm vào một phím để xem mô tả, bấm để vào.")}</p>}
          </div>
        </div>
      </div>
    </section>
  );
}
