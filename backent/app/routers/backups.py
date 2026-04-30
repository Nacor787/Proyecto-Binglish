"""
backups.py — Router FastAPI para endpoints de backup y restauración.
Todos los endpoints requieren la contraseña de administrador.
"""

import os
import shutil
from fastapi import APIRouter, UploadFile, File, Form, HTTPException

from app.core.config import settings
from app.services import backup_service

router = APIRouter(prefix="/backups", tags=["Backups"])


def _verify_password(password: str):
    """Valida la contraseña de backup contra la configuración."""
    if password != settings.BACKUP_PASSWORD:
        raise HTTPException(status_code=401, detail="Contraseña incorrecta")


# ── Listar backups disponibles ──
@router.get("/")
def listar_backups():
    """Retorna la lista de archivos .sql en la carpeta de backups."""
    try:
        return backup_service.list_backups()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Generar backup ──
@router.post("/generate")
def generar_backup(data: dict):
    """
    Genera un backup de la base de datos.
    Body JSON: { "password": "...", "table_name": "opcional" }
    """
    password = data.get("password", "")
    table_name = data.get("table_name") or None

    _verify_password(password)

    try:
        result = backup_service.create_backup(table_name=table_name)
        return result
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Restaurar backup ──
@router.post("/restore")
async def restaurar_backup(
    file: UploadFile = File(...),
    password: str = Form(...)
):
    """
    Restaura la base de datos desde un archivo .sql subido.
    Form data: file (.sql) + password (string).
    """
    _verify_password(password)

    # Validar extensión
    if not file.filename or not file.filename.endswith(".sql"):
        raise HTTPException(
            status_code=400,
            detail="Solo se aceptan archivos con extensión .sql"
        )

    # Guardar archivo temporalmente
    temp_path = os.path.join(backup_service.BACKUP_DIR, f"restore_{file.filename}")
    os.makedirs(backup_service.BACKUP_DIR, exist_ok=True)

    try:
        with open(temp_path, "wb") as f:
            shutil.copyfileobj(file.file, f)

        result = backup_service.restore_backup(temp_path)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # Limpiar archivo temporal
        if os.path.exists(temp_path):
            os.remove(temp_path)


# ── Descargar un backup existente ──
@router.get("/download/{filename}")
def descargar_backup(filename: str):
    """Descarga un archivo de backup existente."""
    from fastapi.responses import FileResponse

    # Prevenir path traversal
    safe_name = os.path.basename(filename)
    filepath = os.path.join(backup_service.BACKUP_DIR, safe_name)

    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Archivo no encontrado")

    return FileResponse(
        path=filepath,
        filename=safe_name,
        media_type="application/sql"
    )


# ── Eliminar un backup existente ──
@router.delete("/delete/{filename}")
def eliminar_backup(filename: str, data: dict):
    """
    Elimina un archivo de backup existente.
    Body JSON: { "password": "..." }
    """
    password = data.get("password", "")
    _verify_password(password)

    try:
        backup_service.delete_backup(filename)
        return {"message": f"Backup {filename} eliminado correctamente"}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Obtener Estado de Windows Task Scheduler ──
@router.get("/config-scheduler")
def obtener_scheduler():
    """
    Devuelve la configuración actual almacenada de la tarea programada.
    """
    try:
        return backup_service.get_scheduler_status()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── Configurar Automatización Windows Task Scheduler ──
@router.post("/config-scheduler")
def configurar_scheduler(data: dict):
    """
    Configura la regla de tareas programadas en Windows.
    Recibe: password, frequency (daily|weekly|monthly|none), day, time_str (HH:MM).
    """
    password = data.get("password")
    _verify_password(password)

    frequency = data.get("frequency")
    day = data.get("day", 1)
    time_str = data.get("time_str", "02:00")

    try:
        result = backup_service.setup_scheduler_task(frequency, int(day), time_str)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
