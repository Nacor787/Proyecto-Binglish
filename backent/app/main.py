from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.db.database import engine, Base

# Importar modelos para que SQLAlchemy los registre
from app.db import models  # noqa: F401

# Importar routers
from app.routers import auth, usuarios, cursos, notas, mensajes, reportes, backups, pagos, biblioteca

# ---------- Crear aplicación ----------

app = FastAPI(
    title="Binglish API",
    description="Sistema de gestión académica para el centro de idiomas Binglish. "
                "Administra usuarios, cursos, notas, mensajes y reportes.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ---------- CORS ----------

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# [OPCIONAL] Para modo estricto en producción usando el .env:
# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=settings.cors_origins_list,
#     allow_credentials=True,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )

# ---------- Registrar routers ----------

app.include_router(auth.router)
app.include_router(usuarios.router)
app.include_router(cursos.router)
app.include_router(notas.router)
app.include_router(mensajes.router)

app.include_router(reportes.router)
app.include_router(backups.router)
app.include_router(pagos.router)
app.include_router(biblioteca.router)


# ---------- Eventos de inicio ----------

@app.on_event("startup")
def on_startup():
    """Crea las tablas en la base de datos de ser necesario."""
    Base.metadata.create_all(bind=engine)
    print("[Startup] Base de datos verificada/creada exitosamente.")


# ---------- Endpoint raíz ----------

@app.get("/", tags=["Root"])
def root():
    """Endpoint raíz de verificación."""
    return {
        "app": "Binglish API",
        "version": "1.0.0",
        "docs": "/docs",
        "status": "running",
    }

