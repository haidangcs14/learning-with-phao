from pydantic import BaseModel, ConfigDict, Field, field_validator

# Parts of speech a card can have (the label is translated by the frontend). "" = not set.
POS = ("noun", "verb", "adjective", "adverb", "preposition", "pronoun", "conjunction", "determiner", "interjection",
       "phrasal_verb", "idiom", "phrase", "collocation", "modal_verb")


class Base(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)


def _pos(v: str | None) -> str | None:
    if v is not None and v != "" and v not in POS:
        raise ValueError(f"part of speech must be one of: {', '.join(POS)}")
    return v


class SetIn(Base):
    title: str = Field(min_length=1, max_length=80)
    description: str = Field("", max_length=300)
    emoji: str = Field("📚", min_length=1, max_length=8)


class SetPatch(Base):
    title: str | None = Field(None, min_length=1, max_length=80)
    description: str | None = Field(None, max_length=300)
    emoji: str | None = Field(None, min_length=1, max_length=8)


class GroupIn(Base):
    title: str = Field(min_length=1, max_length=60)


class CardIn(Base):
    word: str = Field(min_length=1, max_length=60)
    phonetic: str = Field("", max_length=60)
    translation: str = Field(min_length=1, max_length=200)
    pos: str = Field("", max_length=20)
    definition_en: str = Field("", max_length=400)
    definition_vi: str = Field("", max_length=400)
    example_en: str = Field("", max_length=300)
    example_vi: str = Field("", max_length=300)

    _check_pos = field_validator("pos")(_pos)


class CardPatch(Base):
    word: str | None = Field(None, min_length=1, max_length=60)
    phonetic: str | None = Field(None, max_length=60)
    translation: str | None = Field(None, min_length=1, max_length=200)
    pos: str | None = Field(None, max_length=20)
    definition_en: str | None = Field(None, max_length=400)
    definition_vi: str | None = Field(None, max_length=400)
    example_en: str | None = Field(None, max_length=300)
    example_vi: str | None = Field(None, max_length=300)
    group_id: str | None = Field(None, max_length=40)  # moves the card to another group of the same set

    _check_pos = field_validator("pos")(_pos)


class ReorderIn(Base):
    ids: list[str] = Field(min_length=1, max_length=600)


class PublishIn(Base):
    confirm: bool = False


class AnswerIn(Base):
    card_id: str = Field(max_length=64)
    correct: bool
