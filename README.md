# Học cùng Phao

Nền tảng học tiếng Anh: FastAPI + MongoDB + Next.js (TypeScript, Tailwind) + Docker.

## Chạy nhanh
```bash
cp .env.example .env
docker compose up --build
```
- Frontend: http://localhost:3000
- API docs: http://localhost:8000/docs
- Health: http://localhost:8000/health

## Chạy backend không Docker
```bash
cd backend && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
pytest && ruff check .
```
## Seed dữ liệu
```bash
python -m scripts.seed_all          # IPA 44 âm, 21 chủ đề ngữ pháp, 51 động từ BQT, 40 câu, 15 câu hỏi, 28 từ
python -m scripts.create_admin you@mail.com admin StrongPass123
```

## API chính (`/api/v1`)
auth (register/login/refresh/logout/me/change-password) · words (CRUD admin) · favorites ·
flashcards (add/due/review/stats) · ipa · grammar · irregular-verbs · sentences (+`/random`) ·
quiz (questions/submit/history) · games (card_matching) · leaderboard · admin (stats/users/import câu hỏi).
Xem Swagger tại `/docs`.

## Bảo mật & chống gian lận
XP, điểm quiz và điểm game đều do server tính; đáp án không gửi xuống client trước khi nộp bài;
role chỉ đọc từ DB; refresh token trong HTTP-only cookie; import file có preview + xác nhận.

## Kiến trúc backend
Mỗi module: `router` (HTTP) → `service` (nghiệp vụ) → `repository` (MongoDB). Quiz, games, flashcards, admin,
friends, speaking, chatbot đều theo cấu trúc này.

## Refresh token
Access token (30 phút) giữ trong bộ nhớ trình duyệt; refresh token (14 ngày) trong cookie HTTP-only.
Server lưu `jti` của từng refresh token, **xoay vòng** mỗi lần refresh; dùng lại token cũ = bị coi là đánh cắp
→ thu hồi cả chuỗi. Logout, đổi mật khẩu, khoá/xoá user đều thu hồi token.

## AI (chưa nối model)
`app/ai/providers.py` định nghĩa `SpeechToText`, `SpeakingEvaluator`, `LLMProvider` (hiện trả `None`, `AI_PROVIDER=none`).
- **Speaking:** ghi âm → upload (kiểm tra magic bytes, ≤10MB) → lưu file + transcript (Web Speech API của trình duyệt, nếu có)
  + số liệu cơ bản (số từ, từ/phút) + XP. `evaluation` = null cho tới khi nối model.
- **Chatbot:** lưu hội thoại; trả lời bằng `KeywordRetriever` trên kho ngữ pháp/từ vựng/động từ BQT.
  Đổi retriever sang vector search và thêm LLM provider là có RAG, không phải sửa router.

## Tiến độ
- [x] Backend: auth + refresh rotation, words, favorites, flashcards, IPA, grammar, verbs, sentences, quiz, games,
      leaderboard, friends, speaking, chatbot, admin
- [x] Frontend: login/register, dashboard, vocabulary, flashcard, quiz, game, leaderboard, friends, speaking,
      chatbot, admin (dashboard/users/words/questions), dark mode, TanStack Query
- [ ] Nối model AI thật (STT, chấm speaking, LLM/RAG), Google/Facebook OAuth, rate limiting, CI/CD, E2E tests
