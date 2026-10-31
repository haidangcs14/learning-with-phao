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
GAMES += [
    {"id": "word_bridge", "name": "Word Bridge", "modes": ["default"], "description": "Xếp từ thành câu để xây cầu cho chú chim"},
    {"id": "vocab_rain", "name": "Vocabulary Rain", "modes": ["default"], "description": "Gõ từ tiếng Anh trước khi chúng rơi xuống đất"},
]
PAIRS, BLANKS, GAME_DAILY_CAP = 8, 8, 150
BRIDGE_LEVELS, RAIN_WORDS = 10, 20


class GameService:
    def __init__(self, repo: GameRepository, xp: XpService):
        self.repo, self.xp = repo, xp

    @staticmethod
    def check(game_id: str) -> None:
        if game_id not in {g["id"] for g in GAMES}:
            raise NotFoundError("GAME_NOT_FOUND", "Game not found")

    # ---------- start ----------
    async def start(self, user_id: str, game_id: str, topic: str | None = None, count: int | None = None) -> dict:
        self.check(game_id)
        if game_id == "word_bridge":
            return await self._start_bridge(user_id, topic, count)
        if game_id == "vocab_rain":
            return await self._start_rain(user_id, topic, count)
        return await (self._start_matching(user_id) if game_id == "card_matching" else self._start_blank(user_id))

    async def _start_bridge(self, user_id: str, topic: str | None, count: int | None) -> dict:
        """Each level = one example sentence of a word of the chosen topic (with its Vietnamese translation)."""
        want = min(max(count or BRIDGE_LEVELS, 3), 15)
        levels = []
        for w in await self.repo.sample_topic_words(topic, want * 4, True):
            m = w["meanings"][0]
            sentence = (m.get("examples") or [""])[0].strip()
            vi = (m.get("examples_vi") or [""])[0].strip()
            if vi and 3 <= len(sentence.split()) <= 9:
                levels.append({"word": w["word"], "phonetic": w.get("phonetic", ""), "translation_vi": m["translation_vi"], "emoji": w.get("emoji", ""),
                               "sentence": sentence, "sentence_vi": vi})
            if len(levels) == want:
                break
        if len(levels) < 3:
            raise AppException(409, "NOT_ENOUGH_WORDS", "This topic has too few example sentences for the game")
        sid = await self.repo.create_session({"user_id": user_id, "game": "word_bridge", "level_count": len(levels), "max_words": sum(len(x["sentence"].split()) for x in levels),
                                              "topic": topic, "started_at": utcnow(), "finished": False})
        return {"session_id": sid, "levels": levels}

    async def _start_rain(self, user_id: str, topic: str | None, count: int | None) -> dict:
        want = min(max(count or RAIN_WORDS, 5), RAIN_WORDS)
        words = [w for w in await self.repo.sample_topic_words(topic, want, False) if w["word"].replace(" ", "").replace("-", "").isalpha()]
        if len(words) < 5:
            raise AppException(409, "NOT_ENOUGH_WORDS", "This topic has too few words for the game")
        sid = await self.repo.create_session({"user_id": user_id, "game": "vocab_rain", "word_count": len(words), "topic": topic, "started_at": utcnow(), "finished": False})
        return {"session_id": sid, "words": [{"id": str(w["_id"]), "word": w["word"], "phonetic": w.get("phonetic", ""), "translation_vi": w["meanings"][0]["translation_vi"],
                                              "emoji": w.get("emoji", "")} for w in words]}

    # ---------- results of the two new games (the score is recalculated / bounded here) ----------
    async def finish(self, user_id: str, game_id: str, d: dict) -> dict:
        if game_id not in ("word_bridge", "vocab_rain"):
            raise AppException(400, "NOT_SUPPORTED", "This game has no finish endpoint")
        session = await self.repo.close_session(d["session_id"], user_id, game_id, utcnow())
        if not session:
            raise NotFoundError("SESSION_NOT_FOUND", "Session not found or already submitted")
        duration = (utcnow() - as_utc(session["started_at"])).total_seconds()  # server-side clock
        correct = d["correct"]
        if game_id == "word_bridge":
            done, perfect = d["completed"], d["perfect"]
            if done > session["level_count"] or perfect > done or correct > session["max_words"] or duration < correct * 0.8:
                raise AppException(400, "SUSPICIOUS_RESULT", "Result rejected")
            score = correct * 10 + perfect * 50  # 10 per right word, +50 for a sentence without mistakes
            return await self._finalize(user_id, game_id, "default", score, correct, d["mistakes"], done, duration)
        total, score = session["word_count"], d["score"]
        if correct + d["missed"] > total or score > correct * 20 or duration < correct * 1.0:
            raise AppException(400, "SUSPICIOUS_RESULT", "Result rejected")
        return await self._finalize(user_id, game_id, "default", score, correct, d["mistakes"] + d["missed"], correct + d["missed"], duration)

    async def summary(self, user_id: str) -> dict:
        out = {}
        for g in GAMES:
            bests = [await self.repo.best(user_id, g["id"], m) for m in g["modes"]]
            out[g["id"]] = max((b["score"] for b in bests if b), default=None)
        return out

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
