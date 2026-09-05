from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    doctor_password: str = "change-me"
    secret_key: str = "change-this-secret-in-production"
    token_ttl_hours: int = 12
    app_timezone: str = "Asia/Riyadh"
    allowed_origins: str = "http://127.0.0.1:5173,http://localhost:5173"

    @property
    def cors_origins(self) -> List[str]:
        origins = [item.strip() for item in self.allowed_origins.split(",") if item.strip()]
        return origins or ["http://127.0.0.1:5173"]


@lru_cache
def get_settings() -> Settings:
    return Settings()
