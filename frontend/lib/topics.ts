// Topic names are stored in English; the Vietnamese label is only for display.
const TOPICS: Record<string, { icon: string; vi: string }> = {
  "Family & Friends": { icon: "👨‍👩‍👧", vi: "Gia đình & bạn bè" }, "Food & Drink": { icon: "🍜", vi: "Ăn uống" },
  "Travel & Transport": { icon: "✈️", vi: "Du lịch & giao thông" }, "School & Education": { icon: "🎓", vi: "Trường học & giáo dục" },
  "Work & Jobs": { icon: "💼", vi: "Công việc & nghề nghiệp" }, "Health & Body": { icon: "🩺", vi: "Sức khỏe & cơ thể" },
  "Home & Furniture": { icon: "🏠", vi: "Nhà cửa & nội thất" }, "Shopping & Money": { icon: "🛒", vi: "Mua sắm & tiền bạc" },
  "Weather & Nature": { icon: "🌦️", vi: "Thời tiết & thiên nhiên" }, Animals: { icon: "🐾", vi: "Động vật" },
  "Sports & Hobbies": { icon: "⚽", vi: "Thể thao & sở thích" }, Technology: { icon: "💻", vi: "Công nghệ" },
  "Feelings & Personality": { icon: "😊", vi: "Cảm xúc & tính cách" }, "Clothes & Fashion": { icon: "👕", vi: "Quần áo & thời trang" },
  "City & Places": { icon: "🏙️", vi: "Thành phố & địa điểm" }, "Time & Daily Life": { icon: "⏰", vi: "Thời gian & sinh hoạt" },
  "Daily Life": { icon: "📅", vi: "Đời sống thường ngày" },
};

export function topicInfo(topic: string, lang: "vi" | "en"): { icon: string; label: string } {
  const t = TOPICS[topic];
  return { icon: t?.icon ?? "📚", label: lang === "vi" && t ? t.vi : topic };
}
