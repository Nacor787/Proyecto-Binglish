import os
import uuid
import shutil
from typing import List, Optional
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session, joinedload
from fastapi import HTTPException, status, UploadFile
from jose import jwt, JWTError

from app.core.config import settings
from app.db.models import BibliotecaItem, CategoriaBiblioteca, Course, StudentCourse, User

# Directorios de almacenamiento
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads", "biblioteca")
PORTADA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads", "portadas")

# Crear directorios si no existen
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(PORTADA_DIR, exist_ok=True)

SIGNED_URL_EXPIRE_MINUTES = 10


# ==================== CATEGORÍAS ====================

def get_all_categorias(db: Session) -> List[CategoriaBiblioteca]:
    return db.query(CategoriaBiblioteca).order_by(CategoriaBiblioteca.nombre).all()


def get_categoria_by_id(db: Session, cat_id: int) -> Optional[CategoriaBiblioteca]:
    return db.query(CategoriaBiblioteca).filter(CategoriaBiblioteca.id == cat_id).first()


def create_categoria(db: Session, nombre: str, descripcion: Optional[str] = None) -> CategoriaBiblioteca:
    existing = db.query(CategoriaBiblioteca).filter(CategoriaBiblioteca.nombre == nombre).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ya existe una categoría con nombre '{nombre}'",
        )
    cat = CategoriaBiblioteca(nombre=nombre, descripcion=descripcion)
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


def update_categoria(db: Session, cat_id: int, nombre: Optional[str] = None, descripcion: Optional[str] = None) -> CategoriaBiblioteca:
    cat = get_categoria_by_id(db, cat_id)
    if not cat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Categoría no encontrada")

    if nombre is not None:
        existing = db.query(CategoriaBiblioteca).filter(CategoriaBiblioteca.nombre == nombre).first()
        if existing and existing.id != cat_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Ya existe otra categoría con nombre '{nombre}'")
        cat.nombre = nombre

    if descripcion is not None:
        cat.descripcion = descripcion

    db.commit()
    db.refresh(cat)
    return cat


def delete_categoria(db: Session, cat_id: int) -> bool:
    cat = get_categoria_by_id(db, cat_id)
    if not cat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Categoría no encontrada")
    db.delete(cat)
    db.commit()
    return True


# ==================== ITEMS DE BIBLIOTECA ====================

def _query_items(db: Session):
    """Query base con joinedload para relaciones."""
    return db.query(BibliotecaItem).options(
        joinedload(BibliotecaItem.categoria),
        joinedload(BibliotecaItem.curso),
        joinedload(BibliotecaItem.autor),
    )


def list_items(
    db: Session,
    categoria_id: Optional[int] = None,
    curso_id: Optional[int] = None,
    busqueda: Optional[str] = None,
) -> List[BibliotecaItem]:
    q = _query_items(db)

    if categoria_id:
        q = q.filter(BibliotecaItem.categoria_id == categoria_id)
    if curso_id:
        q = q.filter(BibliotecaItem.curso_id == curso_id)
    if busqueda:
        q = q.filter(BibliotecaItem.titulo.ilike(f"%{busqueda}%"))

    return q.order_by(BibliotecaItem.created_at.desc()).all()


def get_item_by_id(db: Session, item_id: int) -> Optional[BibliotecaItem]:
    return _query_items(db).filter(BibliotecaItem.id == item_id).first()


async def upload_item(
    db: Session,
    titulo: str,
    archivo: UploadFile,
    user_id: int,
    descripcion: Optional[str] = None,
    categoria_id: Optional[int] = None,
    curso_id: Optional[int] = None,
    es_publico: bool = False,
    portada: Optional[UploadFile] = None,
) -> BibliotecaItem:
    """Sube un PDF y opcionalmente una portada, crea el registro en BD."""

    # Validar tipo de archivo
    if not archivo.content_type or 'pdf' not in archivo.content_type.lower():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Solo se permiten archivos PDF")

    # Validar tamaño (50MB)
    contents = await archivo.read()
    if len(contents) > 50 * 1024 * 1024:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El archivo excede el límite de 50MB")

    # Guardar PDF
    file_id = str(uuid.uuid4())
    archivo_path = os.path.join(UPLOAD_DIR, f"{file_id}.pdf")
    with open(archivo_path, "wb") as f:
        f.write(contents)

    # Guardar portada si existe
    portada_path = None
    if portada and portada.filename:
        portada_contents = await portada.read()
        ext = portada.filename.rsplit(".", 1)[-1].lower() if "." in portada.filename else "jpg"
        portada_path = os.path.join(PORTADA_DIR, f"{file_id}.{ext}")
        with open(portada_path, "wb") as f:
            f.write(portada_contents)

    # Crear registro
    item = BibliotecaItem(
        titulo=titulo,
        descripcion=descripcion,
        archivo_path=archivo_path,
        portada_path=portada_path,
        categoria_id=categoria_id,
        curso_id=curso_id,
        subido_por=user_id,
        es_publico=es_publico,
    )
    db.add(item)
    db.commit()
    db.refresh(item)

    # Recargar con relaciones
    return get_item_by_id(db, item.id)


def update_item(
    db: Session,
    item_id: int,
    current_user: User,
    titulo: Optional[str] = None,
    descripcion: Optional[str] = None,
    categoria_id: Optional[int] = None,
    curso_id: Optional[int] = None,
    es_publico: Optional[bool] = None,
) -> BibliotecaItem:
    item = get_item_by_id(db, item_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recurso no encontrado")

    # Solo admin o el autor pueden editar
    if current_user.rol.value != "admin" and item.subido_por != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permisos para editar este recurso")

    if titulo is not None:
        item.titulo = titulo
    if descripcion is not None:
        item.descripcion = descripcion
    if categoria_id is not None:
        item.categoria_id = categoria_id
    if curso_id is not None:
        item.curso_id = curso_id
    if es_publico is not None:
        item.es_publico = es_publico

    db.commit()
    db.refresh(item)
    return get_item_by_id(db, item.id)


def delete_item(db: Session, item_id: int) -> bool:
    item = db.query(BibliotecaItem).filter(BibliotecaItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recurso no encontrado")

    # Eliminar archivos del disco
    if item.archivo_path and os.path.exists(item.archivo_path):
        os.remove(item.archivo_path)
    if item.portada_path and os.path.exists(item.portada_path):
        os.remove(item.portada_path)

    db.delete(item)
    db.commit()
    return True


# ==================== URLS FIRMADAS Y ACCESO ====================

def check_access(db: Session, item: BibliotecaItem, user: User) -> bool:
    """Verifica si un usuario tiene acceso a un recurso."""
    # Admin y docente siempre tienen acceso
    if user.rol.value in ("admin", "docente"):
        return True

    # Si es público, todos tienen acceso
    if item.es_publico:
        return True

    # Si tiene curso asociado, verificar inscripción
    if item.curso_id:
        inscrito = db.query(StudentCourse).filter(
            StudentCourse.estudiante_id == user.id,
            StudentCourse.curso_id == item.curso_id,
        ).first()
        return inscrito is not None

    # Sin curso y no público → sin acceso para estudiantes
    return False


def generate_signed_url(item_id: int, user_id: int) -> dict:
    """Genera un token JWT temporal para acceder al PDF."""
    expire = datetime.now(timezone.utc) + timedelta(minutes=SIGNED_URL_EXPIRE_MINUTES)
    payload = {
        "item_id": item_id,
        "user_id": user_id,
        "exp": expire,
        "type": "pdf_view",
    }
    token = jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return {
        "url": f"/biblioteca/{item_id}/view?token={token}",
        "expires_in": SIGNED_URL_EXPIRE_MINUTES * 60,
    }


def verify_signed_token(token: str) -> dict:
    """Decodifica y valida un token de visualización de PDF."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if payload.get("type") != "pdf_view":
            raise JWTError("Tipo de token inválido")
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Token de visualización inválido o expirado",
        )
