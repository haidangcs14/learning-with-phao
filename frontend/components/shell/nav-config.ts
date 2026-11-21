// Vietnamese text is the translation key (English in lib/i18n.ts).
export type NavItem = readonly [href: string, label: string, icon: string];

export const HOME_ITEM: NavItem = ["/dashboard", "Tổng quan", "🏠"];
export const SECTIONS: readonly { label: string; items: readonly NavItem[] }[] = [
  { label: "Học", items: [["/vocabulary", "Từ vựng", "📚"], ["/flashcards", "Flashcard", "🃏"], ["/ipa", "Bảng IPA", "🔤"], ["/grammar", "Ngữ pháp", "🗺️"]] },
  { label: "Kỹ năng", items: [["/speaking", "Luyện nói", "🎙️"], ["/reading", "Đọc hiểu", "📖"], ["/listening", "Luyện nghe", "🎧"], ["/writing", "Luyện viết", "✍️"]] },
  { label: "Luyện tập", items: [["/quiz", "Quiz", "❓"], ["/games", "Trò chơi", "🎮"], ["/exams", "Bài kiểm tra", "📝"]] },
  { label: "Cộng đồng", items: [["/leaderboard", "Xếp hạng", "🏆"], ["/friends", "Bạn bè", "👥"]] },
];
export const PROFILE_ITEM: NavItem = ["/profile", "Hồ sơ cá nhân", "👤"];
export const ADMIN_ITEMS: readonly NavItem[] = [
  ["/admin", "Dashboard", "📊"], ["/admin/users", "Người dùng", "👥"], ["/admin/words", "Từ vựng", "📚"], ["/admin/questions", "Câu hỏi", "❓"],
  ["/admin/exams", "Bài kiểm tra", "📝"], ["/admin/videos", "Video bài nghe", "🎬"], ["/admin/announcements", "Thông báo", "📢"],
];
