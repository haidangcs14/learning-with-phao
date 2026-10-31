from typing import Literal

from pydantic import BaseModel, Field, model_validator


class QuestionIn(BaseModel):
    question: str = Field(min_length=3, max_length=500)
    type: Literal["multiple_choice"] = "multiple_choice"
    level: str = Field(pattern=r"^(A1|A2|B1|B2|C1|C2)$")
    topic: str = Field("General", max_length=50)
    options: list[str] = Field(min_length=2, max_length=6)
    correct_answer: str
    explanation: str = Field("", max_length=1000)

    @model_validator(mode="after")
    def _answer_in_options(self):
        if self.correct_answer not in self.options:
            raise ValueError("correct_answer must be one of options")
        return self


class AnswerIn(BaseModel):
    question_id: str = Field(max_length=64)
    answer: str = Field(max_length=300)


class SubmitIn(BaseModel):
    answers: list[AnswerIn] = Field(min_length=1, max_length=50)


class GenerateIn(BaseModel):
    kind: Literal["word_to_meaning", "meaning_to_word", "definition_to_word"]
    topic: str | None = Field(None, max_length=50)
    level: str | None = Field(None, pattern=r"^(A1|A2|B1|B2|C1|C2)$")
    count: int = Field(10, ge=3, le=30)
