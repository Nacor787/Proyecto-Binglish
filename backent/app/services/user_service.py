from typing import List, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.db.models import User, RolEnum
from app.core.security import hash_password
from app.schemas.user import UserCreate, UserUpdate


def get_user_by_codigo(db: Session, codigo: str) -> Optional[User]:
    """Busca un usuario por código."""
    return db.query(User).filter(User.codigo == codigo).first()


def get_user_by_direccion(db: Session, direccion: str) -> Optional[User]:
    """Busca un usuario por dirección."""
    return db.query(User).filter(User.direccion == direccion).first()


def get_user_by_id(db: Session, user_id: int) -> Optional[User]:
    """Busca un usuario por ID."""
    return db.query(User).filter(User.id == user_id).first()


def get_users(db: Session, skip: int = 0, limit: int = 100) -> List[User]:
    """Lista todos los usuarios con paginación."""
    return db.query(User).offset(skip).limit(limit).all()


def get_users_by_rol(db: Session, rol: str) -> List[User]:
    """Lista usuarios filtrados por rol."""
    return db.query(User).filter(User.rol == rol).all()


def create_user(db: Session, user_data: UserCreate) -> User:
    """Crea un nuevo usuario."""
    existing = get_user_by_codigo(db, user_data.codigo)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El código de usuario ya está registrado",
        )
    db_user = User(
        codigo=user_data.codigo,
        nombre=user_data.nombre,
        apellido=user_data.apellido,
        direccion=user_data.direccion,
        telefono=user_data.telefono,
        hashed_password=hash_password(user_data.password),
        rol=RolEnum(user_data.rol),
        activo=user_data.activo,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


def update_user(db: Session, user_id: int, user_data: UserUpdate) -> User:
    """Actualiza un usuario existente."""
    db_user = get_user_by_id(db, user_id)
    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado",
        )
    update_dict = user_data.model_dump(exclude_unset=True)
    if "password" in update_dict:
        update_dict["hashed_password"] = hash_password(update_dict.pop("password"))
    for key, value in update_dict.items():
        if key == "rol":
            setattr(db_user, key, RolEnum(value))
        else:
            setattr(db_user, key, value)
    db.commit()
    db.refresh(db_user)
    return db_user


def delete_user(db: Session, user_id: int) -> bool:
    """Elimina un usuario por ID."""
    db_user = get_user_by_id(db, user_id)
    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado",
        )
    from sqlalchemy.exc import IntegrityError
    try:
        db.delete(db_user)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se puede eliminar el usuario porque tiene registros vinculados (como notas o cursos).",
        )
    return True
