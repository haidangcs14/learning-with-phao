from typing import Any

from pydantic import BaseModel


class Meta(BaseModel):
    page: int
    limit: int
    total: int
    total_pages: int


class ApiResponse(BaseModel):
    success: bool = True
    data: Any = None
    message: str = "Success"
    meta: Meta | None = None
