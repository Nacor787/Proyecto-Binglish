from typing import List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import User
from app.core.security import get_current_user, require_role
from app.schemas.mensaje import MensajeCreate, MensajeOut, MensajeConteo
from app.services import mensaje_service

router = APIRouter(prefix="/mensajes", tags=["Mensajes / Avisos"])


@router.get("/", response_model=List[MensajeOut])
def listar_mensajes(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "docente"])),
):
    """Lista los mensajes según el rol (admin ve todos, docente ve los suyos)."""
    if current_user.rol == "admin":
        return mensaje_service.get_all_mensajes(db, skip, limit)
    return mensaje_service.get_mensajes_docente(db, current_user.id, skip, limit)


@router.get("/conteo", response_model=MensajeConteo)
def conteo_mensajes(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Obtiene el conteo de mensajes total y no leídos para el usuario actual."""
    if current_user.rol == "admin":
        return mensaje_service.get_conteo_mensajes_admin(db)
    return mensaje_service.get_conteo_mensajes(db, current_user.id)


@router.get("/mis-mensajes", response_model=List[MensajeOut])
def mis_mensajes(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Obtiene los mensajes recibidos por el usuario o avisos generales."""
    return mensaje_service.get_mensajes_recibidos(db, current_user.id)


@router.get("/enviados", response_model=List[MensajeOut])
def mensajes_enviados(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Obtiene los mensajes enviados por el usuario."""
    return mensaje_service.get_mensajes_enviados(db, current_user.id)


from app.core.btrm_validator import validate_btrm_code
from app.services.user_service import get_user_by_codigo

@router.post("/", response_model=MensajeOut, status_code=201)
def crear_mensaje(
    mensaje_data: MensajeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "docente"])),
):
    """
    Crea un nuevo aviso o mensaje (admin o docente).

    Si `destinatario_codigo` es null, el mensaje es un aviso general visible para todos.
    """
    destinatario_id = None
    if mensaje_data.destinatario_codigo:
        codigo_clean = validate_btrm_code(mensaje_data.destinatario_codigo)
        user = get_user_by_codigo(db, codigo_clean)
        if not user:
            from fastapi import HTTPException, status
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No se encontró usuario con código {codigo_clean}",
            )
        destinatario_id = user.id

    return mensaje_service.create_mensaje(db, mensaje_data, current_user.id, destinatario_id)


@router.patch("/marcar-leidos")
def marcar_mensajes_leidos(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Marca todos los mensajes del usuario como leídos."""
    count = mensaje_service.marcar_como_leidos(db, current_user.id)
    return {"message": f"{count} mensajes marcados como leídos"}


@router.patch("/{mensaje_id}/leer", response_model=MensajeOut)
def marcar_mensaje_leido(
    mensaje_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    """Marca un mensaje individual como leído."""
    return mensaje_service.marcar_mensaje_leido(db, mensaje_id, _current_user.id)


@router.delete("/{mensaje_id}")
def eliminar_mensaje(
    mensaje_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role(["admin"])),
):
    """Elimina un mensaje (solo admin)."""
    mensaje_service.delete_mensaje(db, mensaje_id)
    return {"message": "Mensaje eliminado correctamente"}
