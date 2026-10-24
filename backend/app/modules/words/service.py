from app.common.exceptions import NotFoundError
from app.common.pagination import Pagination
from app.common.responses import Meta
from app.modules.words.repository import WordRepository
from app.modules.words.schema import WordFilters, WordOut


class WordService:
    def __init__(self, repo: WordRepository):
        self.repo = repo

    async def list_words(
        self, filters: WordFilters, page: Pagination
    ) -> tuple[list[WordOut], Meta]:
        docs, total = await self.repo.list(
            q=filters.q,
            level=filters.level,
            topic=filters.topic,
            part_of_speech=filters.part_of_speech,
            skip=page.skip,
            limit=page.limit,
        )
        return [WordOut(**d) for d in docs], page.meta(total)

    async def get_word(self, word_id: str) -> WordOut:
        doc = await self.repo.get_by_id(word_id)
        if not doc:
            raise NotFoundError("WORD_NOT_FOUND", "Word not found")
        return WordOut(**doc)

    async def create(self, data) -> WordOut:
        from pymongo.errors import DuplicateKeyError

        from app.common.exceptions import AppException

        try:
            return WordOut(**await self.repo.create(data.model_dump()))
        except DuplicateKeyError as exc:
            raise AppException(409, "WORD_EXISTS", "Word already exists") from exc

    async def update(self, word_id: str, data) -> WordOut:
        from pymongo.errors import DuplicateKeyError

        from app.common.exceptions import AppException

        fields = data.model_dump(exclude_unset=True)
        try:
            doc = await self.repo.update(word_id, fields) if fields else await self.repo.get_by_id(word_id)
        except DuplicateKeyError as exc:
            raise AppException(409, "WORD_EXISTS", "Word already exists") from exc
        if not doc:
            raise NotFoundError("WORD_NOT_FOUND", "Word not found")
        return WordOut(**doc)

    async def delete(self, word_id: str) -> None:
        if not await self.repo.delete(word_id):
            raise NotFoundError("WORD_NOT_FOUND", "Word not found")

    async def topics(self, level: str | None = None) -> list[dict]:
        return await self.repo.topics(level)
