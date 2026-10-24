from datetime import datetime

from pydantic import BaseModel, Field


class Meaning(BaseModel):
    part_of_speech: str
    definition: str
    translation_vi: str
    definition_vi: str = ""
    examples: list[str] = []
    examples_vi: list[str] = []


class WordOut(BaseModel):
    id: str
    word: str
    slug: str
    phonetic: str = ""
    audio_url: str = ""
    meanings: list[Meaning] = []
    level: str = ""
    topics: list[str] = []
    synonyms: list[str] = []
    antonyms: list[str] = []
    collocations: list[str] = []
    emoji: str = ""
    image_url: str = ""
    created_at: datetime | None = None
    updated_at: datetime | None = None


class WordFilters(BaseModel):
    q: str | None = Field(None, max_length=100)
    level: str | None = Field(None, pattern=r"^(A1|A2|B1|B2|C1|C2)$")
    topic: str | None = Field(None, max_length=50)
    part_of_speech: str | None = Field(None, max_length=30)


class WordCreate(BaseModel):
    word: str = Field(min_length=1, max_length=100)
    phonetic: str = Field("", max_length=100)
    audio_url: str = Field("", max_length=500)
    meanings: list[Meaning] = []
    level: str = Field("A1", pattern=r"^(A1|A2|B1|B2|C1|C2)$")
    topics: list[str] = []
    synonyms: list[str] = []
    antonyms: list[str] = []
    collocations: list[str] = []
    emoji: str = Field("", max_length=8)
    image_url: str = Field("", max_length=500, pattern=r"^(|https?://\S+)$")


class WordUpdate(BaseModel):
    word: str | None = Field(None, min_length=1, max_length=100)
    phonetic: str | None = None
    audio_url: str | None = None
    meanings: list[Meaning] | None = None
    level: str | None = Field(None, pattern=r"^(A1|A2|B1|B2|C1|C2)$")
    topics: list[str] | None = None
    synonyms: list[str] | None = None
    antonyms: list[str] | None = None
    collocations: list[str] | None = None
    emoji: str | None = Field(None, max_length=8)
    image_url: str | None = Field(None, max_length=500, pattern=r"^(|https?://\S+)$")
