import math

from fastapi import Query

from app.common.responses import Meta


class Pagination:
    def __init__(self, page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100)):
        self.page, self.limit = page, limit

    @property
    def skip(self) -> int:
        return (self.page - 1) * self.limit

    def meta(self, total: int) -> Meta:
        pages = math.ceil(total / self.limit) if total else 0
        return Meta(page=self.page, limit=self.limit, total=total, total_pages=pages)
