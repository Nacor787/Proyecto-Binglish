from typing import List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import User
from app.core.security import get_current_user, require_role
from app.core.btrm_validator import validate_btrm_code
from app.schemas.user import UserCreate, UserUpdate, UserOut
from app.services import user_service

router = APIRouter(prefix="/usuarios", tags=["Usuarios"])


@router.get("/", response_model=List[UserOut])
def listar_usuarios(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    rol: str = Query(None, description="Filtrar por rol: admin, docente, estudiante"),
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role(["admin", "docente"])),
):
    """Lista todos los usuarios (admin o docente). Permite filtrar por rol."""
    if rol:
        return user_service.get_users_by_rol(db, rol)
    return user_service.get_users(db, skip, limit)


@router.get("/me", response_model=UserOut)
def perfil_actual(current_user: User = Depends(get_current_user)):
    """Obtiene el perfil del usuario autenticado."""
    return current_user


@router.get("/codigo/{codigo}", response_model=UserOut)
def obtener_usuario_por_codigo(
    codigo: str,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role(["admin", "docente"])),
):
    """Busca un usuario por código BTRM-### (admin o docente)."""
    codigo_clean = validate_btrm_code(codigo)
    user = user_service.get_user_by_codigo(db, codigo_clean)
    if not user:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No se encontró usuario con código {codigo_clean}",
        )
    return user


@router.get("/{user_id}", response_model=UserOut)
def obtener_usuario(
    user_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role(["admin"])),
):
    """Obtiene un usuario por ID (solo admin)."""
    user = user_service.get_user_by_id(db, user_id)
    if not user:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")
    return user


@router.post("/", response_model=UserOut, status_code=201)
def crear_usuario(
    user_data: UserCreate,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role(["admin"])),
):
    """Crea un nuevo usuario (solo admin)."""
    return user_service.create_user(db, user_data)


@router.put("/{user_id}", response_model=UserOut)
def actualizar_usuario(
    user_id: int,
    user_data: UserUpdate,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role(["admin"])),
):
    """Actualiza un usuario (solo admin)."""
    return user_service.update_user(db, user_id, user_data)


@router.delete("/{user_id}")
def eliminar_usuario(
    user_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role(["admin"])),
):
    """Elimina un usuario (solo admin)."""
    user_service.delete_user(db, user_id)
    return {"message": "Usuario eliminado correctamente"}
