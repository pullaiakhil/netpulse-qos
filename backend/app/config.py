import os
from typing import Any, List, Optional, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration settings."""

    APP_NAME: str = "NetPulse QoS"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    # Server Network Binding
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # Database
    SQLITE_DB_PATH: Optional[str] = None
    DATABASE_URL: Optional[str] = None

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def assemble_db_url(cls, v: Optional[str], info) -> str:
        if v and str(v).strip():
            return str(v).strip()
        sqlite_path = (info.data.get("SQLITE_DB_PATH") if info.data else None) or os.environ.get("SQLITE_DB_PATH")
        if sqlite_path and sqlite_path.strip():
            clean_path = os.path.abspath(sqlite_path.strip()).replace("\\", "/")
            return f"sqlite+aiosqlite:///{clean_path}"
        return "sqlite+aiosqlite:///./netpulse.db"

    # CORS Origins (supports comma-separated string or list)
    CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: Any) -> List[str]:
        if isinstance(v, str):
            parsed = [origin.strip() for origin in v.split(",") if origin.strip()]
            return parsed if parsed else ["http://localhost:5173", "http://127.0.0.1:5173"]
        if isinstance(v, list):
            parsed = [str(origin).strip() for origin in v if str(origin).strip()]
            return parsed if parsed else ["http://localhost:5173", "http://127.0.0.1:5173"]
        return ["http://localhost:5173", "http://127.0.0.1:5173"]

    # Probing Defaults
    DEFAULT_PROBE_INTERVAL_SECONDS: float = 5.0
    PROBES_PER_QOS_SNAPSHOT: int = 5
    DEFAULT_TIMEOUT_SECONDS: float = 3.0
    DEFAULT_CONSECUTIVE_VIOLATIONS: int = 3
    DEFAULT_AUTO_RESOLVE_COUNT: int = 3

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()

