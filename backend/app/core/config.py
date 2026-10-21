from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: str = "development"
    secret_key: str = "change-me"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 14
    storage_dir: str = "storage"
    ai_provider: str = "none"  # "none" = chưa nối model AI
    backend_url: str = "http://localhost:8000"   # used to build the OAuth redirect URI
    frontend_url: str = "http://localhost:3000"
    google_client_id: str = ""
    google_client_secret: str = ""
    facebook_client_id: str = ""
    facebook_client_secret: str = ""
    smtp_host: str = ""  # empty = emails are not sent (dev: the reset link is printed to the console)
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "Hoc cung Phao <no-reply@localhost>"
    password_reset_minutes: int = 30
    # --- local AI (AI_PROVIDER=local) ---
    stt_model: str = "base.en"      # faster-whisper model: tiny.en | base.en | small.en (bigger = more accurate, slower)
    stt_device: str = "cpu"         # cpu | cuda
    stt_compute: str = "int8"       # int8 (cpu) | float16 (cuda)
    llm_model: str = ""             # Ollama model for grammar feedback / chatbot, e.g. "llama3.2:3b". Empty = rules only
    ollama_url: str = "http://localhost:11434"
    ai_timeout: int = 90
    mongodb_uri: str = "mongodb://localhost:27017"
    mongodb_db_name: str = "english_learning"
    cors_origins: str = "http://localhost:3000"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
