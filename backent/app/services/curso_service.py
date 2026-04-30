from typing import List, Optional
from sqlalchemy.orm import Session, joinedload
from fastapi import HTTPException, status

from app.db.models import Course, StudentCourse, CategoriaNivel, CategoriaModalidad
from app.schemas.curso import CursoCreate, CursoUpdate, CategoriaNivelCreate, CategoriaModalidadCreate


def get_all_cursos(db: Session, skip: int = 0, limit: int = 100) -> List[Course]:
    """Lista todos los cursos con paginación."""
    return db.query(Course).options(
        joinedload(Course.docente),
        joinedload(Course.nivel),
        joinedload(Course.modalidad)
    ).offset(skip).limit(limit).all()


def get_curso_by_id(db: Session, curso_id: int) -> Optional[Course]:
    """Obtiene un curso por su ID."""
    return db.query(Course).options(
        joinedload(Course.docente),
        joinedload(Course.nivel),
        joinedload(Course.modalidad)
    ).filter(Course.id == curso_id).first()


def get_cursos_by_docente(db: Session, docente_id: int) -> List[Course]:
    """Obtiene los cursos asignados a un docente."""
    return db.query(Course).options(
        joinedload(Course.docente),
        joinedload(Course.nivel),
        joinedload(Course.modalidad)
    ).filter(Course.docente_id == docente_id).all()


def create_curso(db: Session, curso_data: CursoCreate) -> Course:
    """Crea un nuevo curso con nombre generado automáticamente."""
    # Obtener el nombre del nivel para el nombre automático
    nivel = db.query(CategoriaNivel).filter(CategoriaNivel.id == curso_data.nivel_id).first()
    nivel_nombre = nivel.nombre if nivel else "Nivel"
    
    # Generar nombre: [Nivel] [Hora Inicio] - [Hora Fin]
    nombre_auto = f"{nivel_nombre} {curso_data.hora_inicio or ''} - {curso_data.hora_fin or ''}".strip()
    
    db_curso = Course(
        nombre=nombre_auto,
        descripcion=curso_data.descripcion,
        docente_id=curso_data.docente_id,
        nivel_id=curso_data.nivel_id,
        modalidad_id=curso_data.modalidad_id,
        hora_inicio=curso_data.hora_inicio,
        hora_fin=curso_data.hora_fin,
        dias=curso_data.dias,
        horas_semanales=curso_data.horas_semanales
    )
    db.add(db_curso)
    db.commit()
    db.refresh(db_curso)
    return db_curso


def update_curso(db: Session, curso_id: int, curso_data: CursoUpdate) -> Course:
    """Actualiza un curso existente y recalcula el nombre si es necesario."""
    db_curso = get_curso_by_id(db, curso_id)
    if not db_curso:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Curso no encontrado",
        )
    
    update_dict = curso_data.model_dump(exclude_unset=True)
    
    # Si cambian campos que afectan al nombre automático
    recalcular_nombre = any(k in update_dict for k in ['nivel_id', 'hora_inicio', 'hora_fin'])
    
    for key, value in update_dict.items():
        setattr(db_curso, key, value)
    
    if recalcular_nombre:
        nivel = db.query(CategoriaNivel).filter(CategoriaNivel.id == db_curso.nivel_id).first()
        nivel_nombre = nivel.nombre if nivel else "Nivel"
        db_curso.nombre = f"{nivel_nombre} {db_curso.hora_inicio or ''} - {db_curso.hora_fin or ''}".strip()

    db.commit()
    db.refresh(db_curso)
    return db_curso


def delete_curso(db: Session, curso_id: int) -> bool:
    """Elimina un curso por ID."""
    db_curso = get_curso_by_id(db, curso_id)
    if not db_curso:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Curso no encontrado",
        )
        
    if db_curso.estudiantes or db_curso.notas:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se puede eliminar: El curso tiene estudiantes inscritos o notas asociadas. Debes eliminar o desasociarlos primero.",
        )
        
    db.delete(db_curso)
    db.commit()
    return True

# --- NIVELES ---
def get_niveles(db: Session):
    return db.query(CategoriaNivel).order_by(CategoriaNivel.id).all()

def create_nivel(db: Session, nivel_data: CategoriaNivelCreate):
    nuevo = CategoriaNivel(nombre=nivel_data.nombre)
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return nuevo

def delete_nivel(db: Session, nivel_id: int):
    n = db.query(CategoriaNivel).filter(CategoriaNivel.id == nivel_id).first()
    if not n:
        raise HTTPException(status_code=404, detail="Nivel no encontrado")
    db.delete(n)
    db.commit()
    return True

# --- MODALIDADES ---
def get_modalidades(db: Session):
    return db.query(CategoriaModalidad).order_by(CategoriaModalidad.id).all()

def create_modalidad(db: Session, modalidad_data: CategoriaModalidadCreate):
    nueva = CategoriaModalidad(nombre=modalidad_data.nombre)
    db.add(nueva)
    db.commit()
    db.refresh(nueva)
    return nueva

def delete_modalidad(db: Session, modalidad_id: int):
    m = db.query(CategoriaModalidad).filter(CategoriaModalidad.id == modalidad_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Modalidad no encontrada")
    db.delete(m)
    db.commit()
    return True


def inscribir_estudiante(db: Session, estudiante_id: int, curso_id: int) -> StudentCourse:
    """Inscribe un estudiante en un curso."""
    existing = db.query(StudentCourse).filter(
        StudentCourse.estudiante_id == estudiante_id,
        StudentCourse.curso_id == curso_id,
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El estudiante ya está inscrito en este curso",
        )
    inscripcion = StudentCourse(
        estudiante_id=estudiante_id,
        curso_id=curso_id,
    )
    db.add(inscripcion)
    db.commit()
    db.refresh(inscripcion)
    return inscripcion


def desinscribir_estudiante(db: Session, estudiante_id: int, curso_id: int) -> bool:
    """Elimina la inscripción de un estudiante en un curso."""
    inscripcion = db.query(StudentCourse).filter(
        StudentCourse.estudiante_id == estudiante_id,
        StudentCourse.curso_id == curso_id,
    ).first()
    if not inscripcion:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No se encontró la inscripción",
        )
    db.delete(inscripcion)
    db.commit()
    return True


def get_estudiantes_de_curso(db: Session, curso_id: int) -> List[StudentCourse]:
    """Obtiene todos los estudiantes inscritos en un curso."""
    return db.query(StudentCourse).filter(StudentCourse.curso_id == curso_id).all()


def get_all_inscripciones(db: Session, skip: int = 0, limit: int = 200) -> List[StudentCourse]:
    """Obtiene todas las inscripciones del sistema con relaciones cargadas."""
    return db.query(StudentCourse).options(
        joinedload(StudentCourse.estudiante),
        joinedload(StudentCourse.curso).joinedload(Course.nivel)
    ).offset(skip).limit(limit).all()
