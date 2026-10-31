from app.common.exceptions import AppException, NotFoundError
from app.common.mongo import utcnow
from app.modules.leaderboard.service import XpService
from app.modules.quiz.repository import QuizRepository
from app.modules.quiz.generator import build_questions
from app.modules.quiz.schema import GenerateIn, SubmitIn

XP_PER_CORRECT, QUIZ_DAILY_CAP = 10, 300


class QuizService:
    def __init__(self, repo: QuizRepository, xp: XpService):
        self.repo, self.xp = repo, xp

    async def questions(self, level: str | None, topic: str | None, limit: int) -> list[dict]:
        match = {k: v for k, v in (("level", level), ("topic", topic)) if v}
        return await self.repo.sample(match, limit)

    async def submit(self, user_id: str, data: SubmitIn) -> dict:
        given = {a.question_id: a.answer for a in data.answers}  # de-duplicates question ids
        questions = await self.repo.by_ids(list(given))
        if not questions:
            raise AppException(400, "INVALID_QUESTIONS", "No valid questions submitted")
        results, correct = [], 0
        for qid, q in questions.items():
            ok = given[qid] == q["correct_answer"]
            correct += ok
            results.append({"question_id": qid, "correct": ok, "your_answer": given[qid],
                            "correct_answer": q["correct_answer"], "explanation": q.get("explanation", "")})
        xp = await self.xp.award(user_id, "quiz", correct * XP_PER_CORRECT, daily_cap=QUIZ_DAILY_CAP)
        await self.repo.save_attempt({"user_id": user_id, "total": len(results), "correct": correct,
                                      "xp": xp, "question_ids": list(questions), "created_at": utcnow()})
        return {"total": len(results), "correct": correct, "accuracy": round(correct / len(results) * 100),
                "xp_awarded": xp, "results": results}

    async def topics(self) -> list[dict]:
        return await self.repo.bank_topics()

    async def generate(self, user_id: str, data: GenerateIn) -> dict:
        pool = await self.repo.words_pool(data.topic, data.level, 200)
        try:
            built = build_questions(pool, data.kind, data.count)
        except ValueError as exc:
            raise AppException(409, "NOT_ENOUGH_WORDS", "Not enough words for this choice: pick another topic or level") from exc
        questions = [{"id": f"q{i}", **q} for i, q in enumerate(built)]
        sid = await self.repo.create_session({"user_id": user_id, "kind": data.kind, "questions": questions, "finished": False})
        return {"session_id": sid, "questions": [{"id": q["id"], "question": q["question"], "options": q["options"]} for q in questions]}  # no answers

    async def submit_session(self, user_id: str, session_id: str, data: SubmitIn) -> dict:
        session = await self.repo.close_session(session_id, user_id)
        if not session:
            raise NotFoundError("SESSION_NOT_FOUND", "Quiz not found or already submitted")
        given = {a.question_id: a.answer for a in data.answers}
        results, correct = [], 0
        for q in session["questions"]:
            ok = given.get(q["id"]) == q["correct_answer"]
            correct += ok
            results.append({"question_id": q["id"], "correct": ok, "your_answer": given.get(q["id"], ""), "correct_answer": q["correct_answer"], "explanation": q["explanation"]})
        xp = await self.xp.award(user_id, "quiz", correct * XP_PER_CORRECT, daily_cap=QUIZ_DAILY_CAP)
        await self.repo.save_attempt({"user_id": user_id, "total": len(results), "correct": correct, "xp": xp, "kind": session["kind"], "created_at": utcnow()})
        return {"total": len(results), "correct": correct, "accuracy": round(correct / len(results) * 100), "xp_awarded": xp, "results": results}
