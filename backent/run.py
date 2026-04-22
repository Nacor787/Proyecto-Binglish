"""
Binglish — Script de arranque del servidor.
Lee API_HOST y API_PORT desde .env para que todo quede centralizado.

Uso:
    python run.py
"""

import uvicorn
from app.core.config import settings

if __name__ == "__main__":
    print(f"🚀 Iniciando Binglish API en {settings.API_HOST}:{settings.API_PORT}")
    uvicorn.run(
        "app.main:app",
        host=settings.API_HOST,
        port=settings.API_PORT,
        reload=True,  # Quitaremos en producción
    )
