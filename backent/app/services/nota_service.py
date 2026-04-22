from typing import List, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.db.models import Grade
from app.schemas.nota import NotaCreate, NotaUpdate


def get_notas_by_estudiante(db: Session, estudiante_id: int) -> List[Grade]:
    """Obtiene todas las notas de un estudiante."""
    return db.query(Grade).filter(Grade.estudiante_id == estudiante_id).all()


def get_notas_by_curso(db: Session, curso_id: int) -> List[Grade]:
    """Obtiene todas las notas de un curso."""
    return db.query(Grade).filter(Grade.curso_id == curso_id).all()


def get_nota_by_id(db: Session, nota_id: int) -> Optional[Grade]:
    """Obtiene una nota por su ID."""
    return db.query(Grade).filter(Grade.id == nota_id).first()


def get_all_notas(db: Session, skip: int = 0, limit: int = 100) -> List[Grade]:
    """Lista todas las notas con paginación."""
    return db.query(Grade).offset(skip).limit(limit).all()


def create_nota(db: Session, nota_data: NotaCreate, estudiante_id: int) -> Grade:
    """Registra una nueva nota con todos los criterios del Report Card."""
    # Convertir el esquema a dict y remover campos que no van directo al modelo
    data_dict = nota_data.model_dump()
    data_dict.pop("estudiante_codigo", None)
    
    db_nota = Grade(
        estudiante_id=estudiante_id,
        **data_dict
    )
    db.add(db_nota)
    db.commit()
    db.refresh(db_nota)
    return db_nota


def update_nota(db: Session, nota_id: int, nota_data: NotaUpdate) -> Grade:
    """Actualiza una nota existente."""
    db_nota = get_nota_by_id(db, nota_id)
    if not db_nota:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nota no encontrada",
        )
    update_dict = nota_data.model_dump(exclude_unset=True)
    for key, value in update_dict.items():
        setattr(db_nota, key, value)
    db.commit()
    db.refresh(db_nota)
    return db_nota


def delete_nota(db: Session, nota_id: int) -> bool:
    """Elimina una nota por ID."""
    db_nota = get_nota_by_id(db, nota_id)
    if not db_nota:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nota no encontrada",
        )
    db.delete(db_nota)
    db.commit()
    return True
