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
  ["Hello", "Giao tiếp", "Mẫu câu giao tiếp hằng ngày theo chủ đề, có phát âm.", "#16a34a", "/sentences"],
  ["Aa", "Từ vựng", "Học từ theo cấp độ, nghe phát âm, lưu yêu thích.", "#0ea5e9", "/vocabulary"],
  ["Gr", "Ngữ pháp", "12 thì và các cấu trúc quan trọng, có công thức và bài tập.", "#7c3aed", "/grammar"],
  ["IPA", "Phát âm", "Bảng 44 âm IPA kèm cách đặt lưỡi, từ ví dụ và video.", "#ef4444", "/ipa"],
  ["Cards", "Flashcard", "Ôn từ vựng bằng thẻ lật theo lịch lặp lại ngắt quãng.", "#65a30d", "/flashcards"],
  ["Speak", "Nói", "Ghi âm theo chủ đề, xem sóng âm và lưu lại bài nói.", "#f97316", "/speaking"],
  ["Listen", "Nghe", "Nghe hội thoại và bài nói theo cấp độ, rồi trả lời câu hỏi.", "#0e7490", "/listening"],
  ["Read", "Đọc", "Bài đọc từ A1 đến C1 kèm từ vựng và câu hỏi trắc nghiệm.", "#1d4ed8", "/reading"],
  ["Write", "Viết", "Viết đoạn văn theo đề, AI chấm điểm và sửa lỗi.", "#be185d", "/writing"],
  ["Exam", "Kiểm tra", "Làm bài kiểm tra có tính giờ do giáo viên tải lên.", "#b45309", "/exams"],
  ["Quiz", "Trắc nghiệm", "Làm bài trắc nghiệm nhanh, đúng sai hiện rõ màu sắc.", "#ca8a04", "/quiz"],
  ["Match", "Lật thẻ", "Trò chơi lật thẻ ghi nhớ cặp từ - nghĩa, tính điểm cao nhất.", "#db2777", "/games?game=match"],
  ["Fill", "Điền từ", "Chọn từ đúng điền vào chỗ trống trong câu.", "#0891b2", "/games?game=blank"],
  ["Verb", "Động từ BQT", "Bảng động từ bất quy tắc, có chế độ tự kiểm tra.", "#4f46e5", "/irregular-verbs"],
  ["Chat", "Trợ lý AI", "Hỏi đáp ngữ pháp, từ vựng với trợ lý tiếng Anh.", "#2563eb", "#chat"],
  ["Rank", "Xếp hạng", "Xem bạn đứng ở đâu trên bảng xếp hạng XP.", "#e11d48", "/leaderboard"],
  ["Friends", "Bạn bè", "Kết bạn và so sánh mức độ chăm chỉ.", "#0d9488", "/friends"],
  ["Daily", "Tổng quan", "Xem XP, chuỗi ngày học và biểu đồ chăm chỉ.", "#ea580c", "/dashboard"],
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
    <section className="relative isolate h-[calc(100svh-3.5rem)] min-h-[620px] overflow-hidden bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white">
      <KeyboardHero keys={keys} onKeyClick={onKeyClick} onKeyHover={setHovered} catSrc="/cute.gif" />
      <div className="pointer-events-none relative z-10 mx-auto flex h-full max-w-6xl flex-col px-6 pt-8 lg:justify-center lg:pt-0">
        <div className="max-w-md space-y-5">
          <p className="inline-block rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur">{t("Miễn phí cho người Việt")}</p>
          <h1 className="text-4xl font-extrabold leading-tight sm:text-5xl lg:text-6xl">
            Học cùng <span className="bg-gradient-to-r from-indigo-400 to-pink-400 bg-clip-text text-transparent">Phao</span>
          </h1>
          <p className="text-lg text-slate-200">{t("Học tiếng Anh mỗi ngày")}</p>
          <p className="hidden text-sm text-slate-300 sm:block">{t("Bấm vào các phím trên bàn phím 3D để chọn kỹ năng bạn muốn luyện.")}</p>
          <div className="pointer-events-auto flex flex-wrap gap-3">
            <Link href={user ? "/dashboard" : "/register"} className="rounded-lg bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-400">
              {user ? t("Tiếp tục học →") : t("Bắt đầu học")}
            </Link>
            {!user && <Link href="/login" className="rounded-lg border border-white/30 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10">{t("Đăng nhập")}</Link>}
          </div>
          <div className="min-h-[92px] rounded-xl border border-white/15 bg-white/10 p-4 text-sm backdrop-blur" aria-live="polite">
            {hovered ? (
              <>
                <p className="font-semibold" style={{ color: hovered.color }}>{hovered.label} · {hovered.sub}</p>
                <p className="mt-1 text-slate-100">{hovered.desc}</p>
              </>
            ) : <p className="text-slate-300">{t("Di chuột hoặc chạm vào một phím để xem mô tả, bấm để vào.")}</p>}
          </div>
        </div>
      </div>
    </section>
  );
}
