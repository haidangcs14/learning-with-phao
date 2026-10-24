from typing import Literal

from pydantic import BaseModel, Field, field_validator


class OptionIn(BaseModel):
    key: str = Field(max_length=4)
    text: str = Field("", max_length=500)


class QuestionIn(BaseModel):
    no: int = Field(ge=1, le=1000)
    type: Literal["mc", "fill"]
    prompt: str = Field("", max_length=2000)
    options: list[OptionIn] = Field(default_factory=list, max_length=8)
    correct: list[str] = Field(default_factory=list, max_length=10)
    explanation: str = Field("", max_length=2000)
    inline: bool = False

    @field_validator("correct")
    @classmethod
    def _short_answers(cls, v: list[str]) -> list[str]:
        return [a.strip()[:200] for a in v if a.strip()]


class GroupIn(BaseModel):
    id: str = Field(max_length=40)
    section: str = Field("", max_length=80)
    kind: Literal["normal", "listening"] = "normal"
    instruction: str = Field("", max_length=2000)
    passage: list[str] = Field(default_factory=list, max_length=200)
    questions: list[QuestionIn] = Field(default_factory=list, max_length=300)


class UpdateExamIn(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=200)
    duration_minutes: int | None = Field(None, ge=1, le=600)
    total_score: float | None = Field(None, gt=0, le=1000)
    transcript: str | None = Field(None, max_length=50000)
    status: Literal["draft", "published"] | None = None
    groups: list[GroupIn] | None = Field(None, max_length=60)


class AnswersIn(BaseModel):
    answers: dict[str, str] = Field(default_factory=dict, max_length=500)

    @field_validator("answers")
    @classmethod
    def _trim(cls, v: dict[str, str]) -> dict[str, str]:
        return {str(k)[:10]: str(a)[:500] for k, a in v.items()}
