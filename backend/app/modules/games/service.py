import random

from app.common.exceptions import AppException, NotFoundError
from app.common.mongo import as_utc, utcnow
from app.modules.games.repository import GameRepository
from app.modules.leaderboard.service import XpService

GAMES = [
    {"id": "card_matching", "name": "Card Matching", "modes": ["classic", "memory"],
     "description": "Ghép từ tiếng Anh với nghĩa tiếng Việt"},
    {"id": "fill_blank", "name": "Fill in the Blank", "modes": ["default"],
     "description": "Chọn từ đúng điền vào chỗ trống"},
]
PAIRS, BLANKS, GAME_DAILY_CAP = 8, 8, 150


class GameService:
    def __init__(self, repo: GameRepository, xp: XpService):
        self.repo, self.xp = repo, xp

    @staticmethod
    def check(game_id: str) -> None:
        if game_id not in {g["id"] for g in GAMES}:
            raise NotFoundError("GAME_NOT_FOUND", "Game not found")

    # ---------- start ----------
    async def start(self, user_id: str, game_id: str) -> dict:
        self.check(game_id)
        return await (self._start_matching(user_id) if game_id == "card_matching" else self._start_blank(user_id))

    async def _start_matching(self, user_id: str) -> dict:
        words = await self.repo.sample_words(PAIRS)
        if len(words) < 2:
            raise AppException(409, "NOT_ENOUGH_WORDS", "Not enough words to start the game")
        pairs = [{"pair_id": str(w["_id"]), "en": w["word"], "vi": w["meanings"][0]["translation_vi"]}
                 for w in words]
        sid = await self.repo.create_session({"user_id": user_id, "game": "card_matching",
                                              "pair_count": len(pairs), "started_at": utcnow(), "finished": False})
        return {"session_id": sid, "pairs": pairs}

    async def _start_blank(self, user_id: str) -> dict:
        items = await self.repo.sample_cloze(BLANKS)
        if not items:
            raise AppException(409, "NOT_ENOUGH_QUESTIONS", "No questions yet. Run the seed script.")
        questions = [{"id": q["id"], "sentence": q["sentence"], "options": random.sample(q["options"], len(q["options"]))}
                     for q in items]  # answers are NOT sent to the client
        sid = await self.repo.create_session({
            "user_id": user_id, "game": "fill_blank", "question_ids": [q["id"] for q in questions],
            "answers": {}, "started_at": utcnow(), "finished": False})
        return {"session_id": sid, "questions": questions}

    # ---------- card matching result ----------
    async def submit(self, user_id: str, game_id: str, session_id: str, correct: int, wrong: int,
                     mode: str, flips: int) -> dict:
        if game_id != "card_matching":
            raise AppException(400, "NOT_SUPPORTED", "This game has no manual submit")
        session = await self.repo.close_session(session_id, user_id, game_id, utcnow())
        if not session:
            raise NotFoundError("SESSION_NOT_FOUND", "Session not found or already submitted")
        pairs = session["pair_count"]
        duration = (utcnow() - as_utc(session["started_at"])).total_seconds()  # server-side clock
        if mode == "memory":
            wrong = max(0, flips - correct)  # every non-matching turn is a mistake
            invalid = flips < correct or duration < pairs * 1.2
            penalty, bonus_cap = 10, 90
        else:
            flips = correct + wrong
            invalid = duration < pairs * 0.8
            penalty, bonus_cap = 20, 60
        if invalid or correct > pairs:
            raise AppException(400, "SUSPICIOUS_RESULT", "Result rejected")
        score = max(0, correct * 100 - wrong * penalty + max(0, bonus_cap - int(duration)))
        return await self._finalize(user_id, game_id, mode, score, correct, wrong, flips, duration)

    async def _finalize(self, user_id, game, mode, score, correct, wrong, flips, duration) -> dict:
        previous = await self.repo.best(user_id, game, mode)
        xp = await self.xp.award(user_id, "game", min(correct * 3, 30), daily_cap=GAME_DAILY_CAP)
        await self.repo.save_result({"user_id": user_id, "game": game, "mode": mode, "score": score,
                                     "correct": correct, "wrong": wrong, "flips": flips,
                                     "duration": round(duration), "created_at": utcnow()})
        record = score > 0 and (previous is None or score > previous["score"])
        return {"score": score, "duration": round(duration), "flips": flips, "xp_awarded": xp, "is_record": record}

    # ---------- fill in the blank ----------
    async def answer(self, user_id: str, game_id: str, session_id: str, question_id: str, answer: str) -> dict:
        if game_id != "fill_blank":
            raise NotFoundError("GAME_NOT_FOUND", "Game not found")
        session = await self.repo.get_session(session_id, user_id, game_id)
        if not session or session["finished"]:
            raise NotFoundError("SESSION_NOT_FOUND", "Session not found or already finished")
        if question_id not in session["question_ids"]:
            raise AppException(400, "INVALID_QUESTION", "Question is not part of this session")
        q = await self.repo.cloze_by_id(question_id)
        if not q:
            raise NotFoundError("QUESTION_NOT_FOUND", "Question not found")
        correct = answer == q["answer"]
        if not await self.repo.record_answer(session_id, user_id, question_id, {"answer": answer, "correct": correct}):
            raise AppException(409, "ALREADY_ANSWERED", "This question was already answered")

        out = {"correct": correct, "correct_answer": q["answer"], "vi": q.get("vi", ""), "finished": False}
        session = await self.repo.get_session(session_id, user_id, game_id)
        total = len(session["question_ids"])
        if len(session["answers"]) >= total and await self.repo.close_session(session_id, user_id, game_id, utcnow()):
            right = sum(1 for a in session["answers"].values() if a["correct"])
            duration = (utcnow() - as_utc(session["started_at"])).total_seconds()
            score = right * 100 + (max(0, 90 - int(duration)) if right else 0)
            summary = await self._finalize(user_id, game_id, "default", score, right, total - right, total, duration)
            out.update(finished=True, total=total, total_correct=right, **summary)
        return out

    # ---------- best score ----------
    async def best(self, user_id: str, game_id: str) -> dict:
        self.check(game_id)
        modes = next(g["modes"] for g in GAMES if g["id"] == game_id)
        out = {}
        for m in modes:
            b = await self.repo.best(user_id, game_id, m)
            out[m] = {"score": b["score"], "flips": b.get("flips"), "duration": b.get("duration")} if b else None
        return out
