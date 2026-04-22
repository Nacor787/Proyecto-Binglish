from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # Servidor
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000

    # Base de datos
    DATABASE_URL: str = "postgresql://postgres:admin@localhost:5432/binglish_db"

    # JWT
    SECRET_KEY: str  # Sin valor por defecto — DEBE estar en .env
    REFRESH_SECRET_KEY: str  
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # CORS
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:5600,http://127.0.0.1:5600"

    # Backup
    BACKUP_PASSWORD: str = "admin123"
    BACKUP_INTERVAL: str = "weekly"  # "daily", "weekly", "monthly"

    # API Keys
    API_NACOR_GPT4O: str = ""

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
# Configuraciones cargadas
