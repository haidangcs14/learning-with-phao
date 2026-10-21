"""Local speech-to-text with faster-whisper (CPU is fine). The model is downloaded once, then works offline."""
import asyncio
import threading

from app.core.config import get_settings


class FasterWhisperSTT:
    def __init__(self) -> None:
        self._model = None
        self._lock = threading.Lock()

    def _load(self):
        with self._lock:
            if self._model is None:
                from faster_whisper import WhisperModel  # imported lazily: the package is optional

                s = get_settings()
                self._model = WhisperModel(s.stt_model, device=s.stt_device, compute_type=s.stt_compute)
            return self._model

    def _run(self, path: str, language: str) -> dict:
        model = self._load()
        segments, info = model.transcribe(path, language=language, word_timestamps=True, vad_filter=True,
                                          beam_size=1, condition_on_previous_text=False)
        texts, words = [], []
        for seg in segments:  # `segments` is a lazy generator: iterating runs the model
            texts.append(seg.text.strip())
            for w in seg.words or []:
                words.append({"word": w.word.strip(), "start": round(w.start, 2), "end": round(w.end, 2), "prob": round(w.probability, 3)})
        return {"text": " ".join(t for t in texts if t).strip(), "words": words,
                "duration": round(info.duration, 2), "engine": f"faster-whisper:{get_settings().stt_model}"}

    async def transcribe(self, audio_path: str, language: str = "en") -> dict:
        return await asyncio.to_thread(self._run, audio_path, language)  # CPU-heavy: keep the event loop free
