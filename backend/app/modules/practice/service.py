from app.common.exceptions import AppException, NotFoundError
from app.common.mongo import serialize, utcnow
from app.modules.leaderboard.service import XpService
from app.modules.practice.repository import PracticeRepository

XP_PER_NEW_CORRECT, DAILY_CAP = 5, 100


class PracticeService:
    def __init__(self, repo: PracticeRepository, xp: XpService):
        self.repo, self.xp = repo, xp

    async def detail(self, kind: str, slug: str) -> dict:
        doc = await self.repo.get(kind, slug)
        if not doc:
            raise NotFoundError("ITEM_NOT_FOUND", "Item not found")
        out = serialize(doc)
        out["questions"] = [{"q": q["q"], "options": q["options"]} for q in out["questions"]]  # answers stay on the server
        return out

    async def progress(self, user_id: str, kind: str) -> dict:
        best = await self.repo.best_by_slug(user_id, kind)
        return {"best": best, "completed": len(best), "points": sum(b["correct"] for b in best.values())}

    async def submit(self, user_id: str, kind: str, slug: str, answers: list[int]) -> dict:
        doc = await self.repo.get(kind, slug)
        if not doc:
            raise NotFoundError("ITEM_NOT_FOUND", "Item not found")
        questions = doc["questions"]
        if len(answers) != len(questions):
            raise AppException(400, "INVALID_ANSWERS", "Answer every question")
        results = [{"correct": a == q["answer"], "your_answer": a, "answer": q["answer"]} for q, a in zip(questions, answers)]
        correct = sum(r["correct"] for r in results)
        previous = await self.repo.best_for(user_id, kind, slug)
        # XP only for improving the personal best => repeating the same text can't be farmed
        xp = await self.xp.award(user_id, kind, max(0, correct - previous) * XP_PER_NEW_CORRECT, daily_cap=DAILY_CAP)
        await self.repo.save_attempt({"user_id": user_id, "kind": kind, "slug": slug, "correct": correct,
                                      "total": len(questions), "created_at": utcnow()})
        return {"total": len(questions), "correct": correct, "xp_awarded": xp, "results": results}
