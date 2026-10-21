from app.common.exceptions import AppException
from app.common.mongo import utcnow
from app.modules.leaderboard.service import XpService
from app.modules.quiz.repository import QuizRepository
from app.modules.quiz.schema import SubmitIn

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
