from typing import Literal

from pydantic import BaseModel, Field


class AddCardIn(BaseModel):
    word_id: str = Field(max_length=64)


class ReviewIn(AddCardIn):
    rating: Literal["again", "hard", "good", "easy"]
