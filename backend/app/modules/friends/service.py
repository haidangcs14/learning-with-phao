from app.common.exceptions import AppException, NotFoundError
from app.modules.friends.repository import FriendRepository
from app.modules.leaderboard.service import XpService


class FriendService:
    def __init__(self, repo: FriendRepository, xp: XpService):
        self.repo, self.xp = repo, xp

    @staticmethod
    def _relation(me: str, f: dict | None) -> str:
        if not f:
            return "none"
        if f["status"] == "accepted":
            return "friends"
        return "pending_sent" if f["requester_id"] == me else "pending_received"

    async def search(self, me: str, q: str) -> list[dict]:
        users = await self.repo.search_users(q, me)
        for u in users:
            u["relation"] = self._relation(me, await self.repo.find_pair(me, u["id"]))
        return users

    async def send_request(self, me: str, target_id: str) -> dict:
        if target_id == me:
            raise AppException(400, "CANNOT_ADD_SELF", "You cannot add yourself")
        if target_id not in await self.repo.briefs([target_id]):
            raise NotFoundError("USER_NOT_FOUND", "User not found")
        if await self.repo.find_pair(me, target_id):
            raise AppException(409, "ALREADY_EXISTS", "A request or friendship already exists")
        return await self.repo.create(me, target_id)

    async def requests(self, me: str) -> dict:
        inc, out = await self.repo.incoming(me), await self.repo.outgoing(me)
        users = await self.repo.briefs([r["requester_id"] for r in inc] + [r["receiver_id"] for r in out])
        return {"incoming": [{**r, "user": users.get(r["requester_id"])} for r in inc],
                "outgoing": [{**r, "user": users.get(r["receiver_id"])} for r in out]}

    async def respond(self, me: str, friendship_id: str, accept: bool) -> None:
        f = await self.repo.get(friendship_id)
        # only the receiver of a pending request may answer it
        if not f or f["receiver_id"] != me or f["status"] != "pending":
            raise NotFoundError("REQUEST_NOT_FOUND", "Request not found")
        await (self.repo.accept(friendship_id) if accept else self.repo.delete(friendship_id))

    async def remove(self, me: str, other_id: str) -> None:
        f = await self.repo.find_pair(me, other_id)
        if not f:
            raise NotFoundError("FRIEND_NOT_FOUND", "Friendship not found")
        await self.repo.delete(f["id"])

    async def friends(self, me: str) -> list[dict]:
        rows = await self.repo.accepted(me)
        ids = [r["receiver_id"] if r["requester_id"] == me else r["requester_id"] for r in rows]
        users = await self.repo.briefs(ids)
        out = [{**users[i], "total_xp": await self.xp.total(i, "all")} for i in ids if i in users]
        return sorted(out, key=lambda u: -u["total_xp"])

    async def compare(self, me: str, other_id: str) -> dict:
        f = await self.repo.find_pair(me, other_id)
        if not f or f["status"] != "accepted":
            raise AppException(403, "NOT_FRIENDS", "You can only compare with friends")
        users = await self.repo.briefs([me, other_id])
        return {"me": {**users[me], **await self.xp.totals(me)},
                "friend": {**users[other_id], **await self.xp.totals(other_id)}}
