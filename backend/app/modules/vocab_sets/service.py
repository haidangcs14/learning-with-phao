from uuid import uuid4

from app.common.exceptions import AppException, NotFoundError
from app.common.mongo import utcnow
from app.modules.leaderboard.service import XpService
from app.modules.vocab_sets.repository import VocabSetRepository
from app.modules.vocab_sets.schema import CardIn, CardPatch, SetIn, SetPatch

MAX_SETS, MAX_GROUPS, MAX_CARDS, MIN_PUBLIC_CARDS = 50, 30, 500, 4
XP_PER_NEW_CARD, DAILY_CAP = 2, 60  # same economy as the built-in vocabulary


def _card_out(c: dict) -> dict:
    return {"id": str(c["_id"]), "set_id": c["set_id"], "group_id": c["group_id"], "word": c["word"], "phonetic": c.get("phonetic", ""), "translation": c["translation"],
            "pos": c.get("pos", ""), "definition_en": c.get("definition_en", ""), "definition_vi": c.get("definition_vi", ""),
            "example_en": c.get("example_en", ""), "example_vi": c.get("example_vi", ""), "position": c.get("position", 0)}


class VocabSetService:
    def __init__(self, repo: VocabSetRepository, xp: XpService):
        self.repo, self.xp = repo, xp

    # ------------------------------------------------------------------ access rules
    async def _get(self, set_id: str, user: dict, *, edit: bool = False) -> dict:
        """Visible to its owner, to everybody once it is public, and to admins (moderation). Only the owner may change it."""
        s = await self.repo.get(set_id)
        owner = bool(s) and s["owner_id"] == user["id"]
        if not s or not (owner or s["status"] == "public" or user.get("role") == "admin"):
            raise NotFoundError("SET_NOT_FOUND", "Vocabulary set not found")  # drafts of other people do not even reveal that they exist
        if edit and not owner:
            raise AppException(403, "NOT_OWNER", "Only the owner can change this vocabulary set")
        return s

    def _group(self, s: dict, group_id: str) -> dict:
        g = next((g for g in s["groups"] if g["id"] == group_id), None)
        if not g:
            raise NotFoundError("GROUP_NOT_FOUND", "Group not found")
        return g

    async def _out(self, rows: list[dict]) -> list[dict]:
        ids = [str(s["_id"]) for s in rows]
        counts, people = await self.repo.card_counts(ids), await self.repo.people([s["owner_id"] for s in rows])
        return [{"id": str(s["_id"]), "title": s["title"], "description": s.get("description", ""), "emoji": s.get("emoji", "📚"), "status": s["status"],
                 "owner": people.get(s["owner_id"]), "group_count": len(s["groups"]), "card_count": counts.get(str(s["_id"]), 0), "position": s.get("position", 0),
                 "created_at": s["created_at"], "updated_at": s["updated_at"], "published_at": s.get("published_at")} for s in rows]

    # ------------------------------------------------------------------ sets
    async def create(self, user: dict, data: SetIn) -> dict:
        if await self.repo.count_mine(user["id"]) >= MAX_SETS:
            raise AppException(409, "LIMIT_REACHED", f"You can create at most {MAX_SETS} vocabulary sets")
        now = utcnow()
        s = await self.repo.create({"owner_id": user["id"], "title": data.title, "description": data.description, "emoji": data.emoji, "status": "draft",  # always a draft first
                                    "position": await self.repo.next_position(user["id"]), "groups": [], "created_at": now, "updated_at": now, "published_at": None})
        return (await self._out([s]))[0]

    async def list_public(self, q: str | None, skip: int, limit: int) -> tuple[list[dict], int]:
        rows, total = await self.repo.list_public(q, skip, limit)
        return await self._out(rows), total

    async def list_mine(self, user: dict) -> list[dict]:
        return await self._out(await self.repo.list_mine(user["id"]))

    async def detail(self, set_id: str, user: dict) -> dict:
        s = await self._get(set_id, user)
        counts = await self.repo.group_counts(set_id)
        out = (await self._out([s]))[0]
        return {**out, "is_owner": s["owner_id"] == user["id"], "groups": [{"id": g["id"], "title": g["title"], "count": counts.get(g["id"], 0)} for g in s["groups"]]}

    async def update(self, set_id: str, user: dict, patch: SetPatch) -> dict:
        await self._get(set_id, user, edit=True)
        changes = patch.model_dump(exclude_none=True)
        if changes:
            await self.repo.update(set_id, changes)
        return await self.detail(set_id, user)

    async def delete(self, set_id: str, user: dict) -> None:
        s = await self._get(set_id, user)
        if s["owner_id"] != user["id"] and user.get("role") != "admin":
            raise AppException(403, "NOT_OWNER", "Only the owner can delete this vocabulary set")
        await self.repo.delete(set_id)

    async def publish(self, set_id: str, user: dict, confirm: bool) -> dict:
        """Making a set public needs an explicit confirmation and at least a few cards (so the quiz mode works)."""
        await self._get(set_id, user, edit=True)
        if not confirm:
            raise AppException(400, "CONFIRM_REQUIRED", "Confirm that you want to share this set with the community")
        if sum((await self.repo.group_counts(set_id)).values()) < MIN_PUBLIC_CARDS:
            raise AppException(409, "NEED_MORE_CARDS", f"Add at least {MIN_PUBLIC_CARDS} cards before sharing this set")
        await self.repo.update(set_id, {"status": "public", "published_at": utcnow()})
        return await self.detail(set_id, user)

    async def unpublish(self, set_id: str, user: dict) -> dict:
        s = await self._get(set_id, user)
        if s["owner_id"] != user["id"] and user.get("role") != "admin":
            raise AppException(403, "NOT_OWNER", "Only the owner can change this vocabulary set")
        await self.repo.update(set_id, {"status": "draft", "published_at": None})
        return await self.detail(set_id, user)

    async def reorder_sets(self, user: dict, ids: list[str]) -> None:
        mine = await self.repo.list_mine(user["id"])
        if sorted(ids) != sorted(str(s["_id"]) for s in mine):
            raise AppException(422, "INVALID_ORDER", "The list must contain each of your sets exactly once")
        for pos, sid in enumerate(ids):
            await self.repo.update(sid, {"position": pos})

    # ------------------------------------------------------------------ groups
    async def add_group(self, set_id: str, user: dict, title: str) -> dict:
        s = await self._get(set_id, user, edit=True)
        if len(s["groups"]) >= MAX_GROUPS:
            raise AppException(409, "LIMIT_REACHED", f"A set can have at most {MAX_GROUPS} groups")
        await self.repo.update(set_id, {"groups": [*s["groups"], {"id": uuid4().hex[:12], "title": title}]})
        return await self.detail(set_id, user)

    async def rename_group(self, set_id: str, group_id: str, user: dict, title: str) -> dict:
        s = await self._get(set_id, user, edit=True)
        self._group(s, group_id)
        await self.repo.update(set_id, {"groups": [{**g, "title": title} if g["id"] == group_id else g for g in s["groups"]]})
        return await self.detail(set_id, user)

    async def delete_group(self, set_id: str, group_id: str, user: dict) -> dict:
        s = await self._get(set_id, user, edit=True)
        self._group(s, group_id)
        await self.repo.delete_group_cards(set_id, group_id)
        await self.repo.update(set_id, {"groups": [g for g in s["groups"] if g["id"] != group_id]})
        return await self.detail(set_id, user)

    async def reorder_groups(self, set_id: str, user: dict, ids: list[str]) -> dict:
        s = await self._get(set_id, user, edit=True)
        if sorted(ids) != sorted(g["id"] for g in s["groups"]):
            raise AppException(422, "INVALID_ORDER", "The list must contain each group exactly once")
        by_id = {g["id"]: g for g in s["groups"]}
        await self.repo.update(set_id, {"groups": [by_id[i] for i in ids]})
        return await self.detail(set_id, user)

    # ------------------------------------------------------------------ cards
    async def cards(self, set_id: str, user: dict, group_id: str | None) -> list[dict]:
        s = await self._get(set_id, user)
        if group_id:
            self._group(s, group_id)
        order = {g["id"]: i for i, g in enumerate(s["groups"])}
        rows = await self.repo.cards_of(set_id, group_id)
        return [_card_out(c) for c in sorted(rows, key=lambda c: (order.get(c["group_id"], 999), c.get("position", 0)))]

    async def add_card(self, set_id: str, group_id: str, user: dict, data: CardIn) -> dict:
        s = await self._get(set_id, user, edit=True)
        self._group(s, group_id)
        if sum((await self.repo.group_counts(set_id)).values()) >= MAX_CARDS:
            raise AppException(409, "LIMIT_REACHED", f"A set can have at most {MAX_CARDS} cards")
        now = utcnow()
        c = await self.repo.add_card({**data.model_dump(), "set_id": set_id, "group_id": group_id, "owner_id": user["id"],
                                      "position": await self.repo.next_card_position(set_id, group_id), "created_at": now, "updated_at": now})
        await self.repo.update(set_id, {})  # touches updated_at
        return _card_out(c)

    async def _card_of(self, set_id: str, card_id: str, user: dict) -> tuple[dict, dict]:
        s = await self._get(set_id, user, edit=True)
        c = await self.repo.card(card_id)
        if not c or c["set_id"] != set_id:
            raise NotFoundError("CARD_NOT_FOUND", "Card not found")
        return s, c

    async def update_card(self, set_id: str, card_id: str, user: dict, patch: CardPatch) -> dict:
        s, c = await self._card_of(set_id, card_id, user)
        changes = patch.model_dump(exclude_none=True)
        target = changes.pop("group_id", None)
        if target and target != c["group_id"]:
            self._group(s, target)
            changes.update(group_id=target, position=await self.repo.next_card_position(set_id, target))
            await self.repo.study.update_many({"card_id": card_id}, {"$set": {"group_id": target}})  # progress follows the card
        if changes:
            await self.repo.update_card(card_id, changes)
        return _card_out(await self.repo.card(card_id) or c)

    async def delete_card(self, set_id: str, card_id: str, user: dict) -> None:
        await self._card_of(set_id, card_id, user)
        await self.repo.delete_card(card_id)

    async def reorder_cards(self, set_id: str, group_id: str, user: dict, ids: list[str]) -> list[dict]:
        s = await self._get(set_id, user, edit=True)
        self._group(s, group_id)
        current = [str(c["_id"]) for c in await self.repo.cards_of(set_id, group_id)]
        if sorted(ids) != sorted(current):
            raise AppException(422, "INVALID_ORDER", "The list must contain each card of the group exactly once")
        await self.repo.set_card_order(ids)
        return await self.cards(set_id, user, group_id)

    # ------------------------------------------------------------------ learning
    async def answer(self, set_id: str, user: dict, card_id: str, correct: bool) -> dict:
        await self._get(set_id, user)
        c = await self.repo.card(card_id)
        if not c or c["set_id"] != set_id:
            raise NotFoundError("CARD_NOT_FOUND", "Card not found")
        new = await self.repo.record(user["id"], c, correct)
        xp = await self.xp.award(user["id"], "vocabulary", XP_PER_NEW_CARD, daily_cap=DAILY_CAP) if new else 0  # only the first time a card is learned
        return {"newly_learned": new, "xp_awarded": xp}

    async def progress(self, set_id: str, user: dict) -> dict[str, int]:
        await self._get(set_id, user)
        return await self.repo.learned_by_group(user["id"], set_id)

    async def learned(self, set_id: str, user: dict, group_id: str) -> list[str]:
        await self._get(set_id, user)
        return await self.repo.learned_ids(user["id"], set_id, group_id)
