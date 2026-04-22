from typing import List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import User
from app.core.security import get_current_user, require_role
from app.schemas.curso import (
    CursoCreate, CursoUpdate, CursoOut, InscripcionCreate, InscripcionOut,
    CategoriaNivelCreate, CategoriaNivelOut, CategoriaModalidadCreate, CategoriaModalidadOut
)
from app.services import curso_service

router = APIRouter(prefix="/cursos", tags=["Cursos"])

# ---------- NIVELES ----------
@router.get("/niveles", response_model=List[CategoriaNivelOut])
def listar_niveles(db: Session = Depends(get_db)):
    return curso_service.get_niveles(db)

@router.post("/niveles", response_model=CategoriaNivelOut, status_code=201)
def crear_nivel(data: CategoriaNivelCreate, db: Session = Depends(get_db), _current_user: User = Depends(require_role(["admin", "docente"]))):
    return curso_service.create_nivel(db, data)

@router.delete("/niveles/{nivel_id}")
def eliminar_nivel(nivel_id: int, db: Session = Depends(get_db), _current_user: User = Depends(require_role(["admin"]))):
    curso_service.delete_nivel(db, nivel_id)
    return {"message": "Nivel eliminado"}

# ---------- MODALIDADES ----------
@router.get("/modalidades", response_model=List[CategoriaModalidadOut])
def listar_modalidades(db: Session = Depends(get_db)):
    return curso_service.get_modalidades(db)

@router.post("/modalidades", response_model=CategoriaModalidadOut, status_code=201)
def crear_modalidad(data: CategoriaModalidadCreate, db: Session = Depends(get_db), _current_user: User = Depends(require_role(["admin", "docente"]))):
    return curso_service.create_modalidad(db, data)

@router.delete("/modalidades/{modalidad_id}")
def eliminar_modalidad(modalidad_id: int, db: Session = Depends(get_db), _current_user: User = Depends(require_role(["admin"]))):
    curso_service.delete_modalidad(db, modalidad_id)
    return {"message": "Modalidad eliminada"}


@router.get("/", response_model=List[CursoOut])
def listar_cursos(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    """Lista todos los cursos disponibles."""
    return curso_service.get_all_cursos(db, skip, limit)


@router.get("/inscripciones/todas", response_model=List[InscripcionOut])
def listar_todas_inscripciones(
    skip: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=1000),
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role(["admin"]))
):
    """Lista todas las inscripciones del sistema (solo admin)."""
    return curso_service.get_all_inscripciones(db, skip, limit)


@router.get("/{curso_id}", response_model=CursoOut)
def obtener_curso(
    curso_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    """Obtiene un curso por ID."""
    from fastapi import HTTPException, status
    curso = curso_service.get_curso_by_id(db, curso_id)
    if not curso:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Curso no encontrado")
    return curso


@router.post("/", response_model=CursoOut, status_code=201)
def crear_curso(
    curso_data: CursoCreate,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role(["admin"])),
):
    """Crea un nuevo curso (solo admin)."""
    return curso_service.create_curso(db, curso_data)


@router.put("/{curso_id}", response_model=CursoOut)
def actualizar_curso(
    curso_id: int,
    curso_data: CursoUpdate,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role(["admin"])),
):
    """Actualiza un curso (solo admin)."""
    return curso_service.update_curso(db, curso_id, curso_data)


@router.delete("/{curso_id}")
def eliminar_curso(
    curso_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role(["admin"])),
):
    """Elimina un curso (solo admin)."""
    curso_service.delete_curso(db, curso_id)
    return {"message": "Curso eliminado correctamente"}


# ---------- Inscripciones ----------

@router.post("/inscripcion", response_model=InscripcionOut, status_code=201)
def inscribir_estudiante(
    data: InscripcionCreate,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role(["admin", "docente"])),
):
    """Inscribir un estudiante a un curso (admin o docente)."""
    return curso_service.inscribir_estudiante(db, data.estudiante_id, data.curso_id)


@router.delete("/inscripcion/{estudiante_id}/{curso_id}")
def desinscribir_estudiante(
    estudiante_id: int,
    curso_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role(["admin", "docente"])),
):
    """Elimina la inscripción de un estudiante en un curso (admin o docente)."""
    curso_service.desinscribir_estudiante(db, estudiante_id, curso_id)
    return {"message": "Inscripción eliminada correctamente"}


@router.get("/{curso_id}/estudiantes", response_model=List[InscripcionOut])
def listar_estudiantes_de_curso(
    curso_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role(["admin", "docente"])),
):
    """Lista los estudiantes inscritos en un curso (admin o docente)."""
    return curso_service.get_estudiantes_de_curso(db, curso_id)
