from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

Level = Literal["A1", "A2", "B1", "B2", "C1", "C2"]
Mode = Literal["easy", "normal", "hard"]


class LessonCreate(BaseModel):
    url: str = Field(min_length=5, max_length=300)
    title: str = Field(min_length=1, max_length=120)
    level: Level = "B1"
    category: str = Field("General", min_length=1, max_length=50)
    transcript: str = Field(min_length=10, max_length=100_000)

    @field_validator("title", "category")
    @classmethod
    def _strip(cls, v: str) -> str:
        return v.strip()


class SentenceEdit(BaseModel):
    text: str = Field(min_length=1, max_length=500)
    start: float = Field(ge=0, le=86_400)
    end: float = Field(gt=0, le=86_400)

    @model_validator(mode="after")
    def _order(self):
        self.text = self.text.strip()
        if not self.text:
            raise ValueError("text must not be empty")
        if self.end <= self.start:
            raise ValueError("end must be after start")
        return self


class CheckIn(BaseModel):
    no: int = Field(ge=1, le=1000)
    answer: str = Field(max_length=1000)
    mode: Mode = "normal"


class ProgressIn(BaseModel):
    answers: dict[str, str] = Field(default_factory=dict, max_length=700)
    mode: Mode = "normal"

    @field_validator("answers")
    @classmethod
    def _limit(cls, v: dict[str, str]) -> dict[str, str]:
        return {str(k)[:5]: str(a)[:1000] for k, a in v.items() if str(k).isdigit()}


class ReportIn(BaseModel):
    no: int = Field(ge=1, le=1000)
    reason: Literal["wrong_text", "wrong_time", "other"]
    note: str = Field("", max_length=500)

    @model_validator(mode="after")
    def _note(self):
        self.note = self.note.strip()
        if self.reason == "other" and len(self.note) < 5:
            raise ValueError("please describe the problem (at least 5 characters)")
        return self
