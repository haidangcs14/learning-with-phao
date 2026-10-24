"""Seed toàn bộ dữ liệu học tập (upsert, chạy lại an toàn). Chạy: python -m scripts.seed_all"""
import asyncio

from motor.motor_asyncio import AsyncIOMotorClient

from app.common.mongo import utcnow
from app.core.config import get_settings
from scripts.data.cloze import CLOZE
from scripts.data.grammar import GRAMMAR
from scripts.data.listening import LISTENING
from scripts.data.reading import READING
from scripts.data.ipa import IPA
from scripts.data.questions import QUESTIONS
from scripts.data.sentences import SENTENCES
from scripts.data.speaking import TOPICS
from scripts.data.verbs import VERBS
from scripts.data.writing import PROMPTS as WRITING
from scripts.data.words import WORDS


async def main() -> None:
    s = get_settings()
    db = AsyncIOMotorClient(s.mongodb_uri)[s.mongodb_db_name]
    now = utcnow()

    for i, (sym, typ, cat, voiced, desc, ex) in enumerate(IPA):
        await db.ipa_sounds.update_one({"symbol": sym}, {"$set": {
            "symbol": sym, "display": f"/{sym}/", "type": typ, "category": cat,
            "voiced": {None: "", True: "true", False: "false"}[voiced],
            "description": desc, "example_words": ex, "audio_url": "", "order": i}}, upsert=True)
    for g in GRAMMAR:
        await db.grammar_lessons.update_one({"slug": g["slug"]}, {"$set": g}, upsert=True)
    for base, past, pp, vi in VERBS:
        await db.irregular_verbs.update_one({"base": base}, {"$set": {
            "base": base, "past": past, "past_participle": pp, "meaning_vi": vi}}, upsert=True)
    for topic, level, en, vi in SENTENCES:
        await db.sentences.update_one({"english": en}, {"$set": {
            "english": en, "vietnamese": vi, "topic": topic, "level": level, "audio_url": ""}}, upsert=True)
    for q, level, topic, options, answer, expl in QUESTIONS:
        await db.questions.update_one({"question": q}, {
            "$set": {"question": q, "type": "multiple_choice", "level": level, "topic": topic,
                     "options": options, "correct_answer": answer, "explanation": expl},
            "$setOnInsert": {"created_at": now}}, upsert=True)
    for w, ph, pos, d, vi, ex, level, topic in WORDS:
        await db.words.update_one({"slug": w}, {
            "$set": {"word": w, "slug": w, "phonetic": ph, "audio_url": "", "level": level,
                     "topics": [topic], "synonyms": [], "antonyms": [], "collocations": [],
                     "meanings": [{"part_of_speech": pos, "definition": d, "translation_vi": vi, "examples": [ex]}],
                     "updated_at": now},
            "$setOnInsert": {"created_at": now}}, upsert=True)
    for sentence, answer, wrong, level, vi in CLOZE:
        await db.cloze_questions.update_one({"sentence": sentence}, {"$set": {
            "sentence": sentence, "answer": answer, "options": [answer, *wrong], "level": level, "vi": vi}}, upsert=True)
    for i, (title, level, instruction, lo, hi, hints, keywords) in enumerate(WRITING):
        await db.writing_prompts.update_one({"title": title}, {"$set": {
            "title": title, "level": level, "instruction": instruction, "min_words": lo, "max_words": hi,
            "hints": hints, "keywords": keywords, "order": i}}, upsert=True)
    for item in READING + LISTENING:
        await db.practice_items.update_one({"kind": item["kind"], "slug": item["slug"]}, {"$set": item}, upsert=True)
    for i, (title, prompt, level, hints) in enumerate(TOPICS):
        await db.speaking_topics.update_one({"title": title}, {"$set": {
            "title": title, "prompt": prompt, "level": level, "hints": hints, "order": i}}, upsert=True)
    print(f"IPA {len(IPA)} | grammar {len(GRAMMAR)} | verbs {len(VERBS)} | sentences {len(SENTENCES)} "
          f"| writing {len(WRITING)} | reading {len(READING)} | listening {len(LISTENING)} | cloze {len(CLOZE)} | questions {len(QUESTIONS)} | words {len(WORDS)}")


if __name__ == "__main__":
    asyncio.run(main())
