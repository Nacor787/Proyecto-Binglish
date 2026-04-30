from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class CategoriaNivelBase(BaseModel):
    nombre: str

class CategoriaNivelCreate(CategoriaNivelBase):
    pass

class CategoriaNivelOut(CategoriaNivelBase):
    id: int
    class Config:
        from_attributes = True

class CategoriaModalidadBase(BaseModel):
    nombre: str

class CategoriaModalidadCreate(CategoriaModalidadBase):
    pass

class CategoriaModalidadOut(CategoriaModalidadBase):
    id: int
    class Config:
        from_attributes = True


class CursoCreate(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    docente_id: Optional[int] = None
    nivel_id: Optional[int] = None
    modalidad_id: Optional[int] = None
    hora_inicio: Optional[str] = None
    hora_fin: Optional[str] = None
    dias: Optional[str] = None
    horas_semanales: Optional[int] = None


class CursoUpdate(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    docente_id: Optional[int] = None
    nivel_id: Optional[int] = None
    modalidad_id: Optional[int] = None
    hora_inicio: Optional[str] = None
    hora_fin: Optional[str] = None
    dias: Optional[str] = None
    horas_semanales: Optional[int] = None


class CursoDocenteInfo(BaseModel):
    id: int
    nombre: str
    apellido: str
    codigo: str

    class Config:
        from_attributes = True

class CursoOut(BaseModel):
    id: int
    nombre: str
    descripcion: Optional[str] = None
    docente_id: Optional[int] = None
    docente: Optional[CursoDocenteInfo] = None
    nivel_id: Optional[int] = None
    modalidad_id: Optional[int] = None
    nivel: Optional[CategoriaNivelOut] = None
    modalidad: Optional[CategoriaModalidadOut] = None
    hora_inicio: Optional[str] = None
    hora_fin: Optional[str] = None
    dias: Optional[str] = None
    horas_semanales: Optional[int] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class InscripcionCreate(BaseModel):
    estudiante_id: int
    curso_id: int


class InscripcionOut(BaseModel):
    id: int
    estudiante_id: int
    curso_id: int
    fecha_inscripcion: Optional[datetime] = None

    class Config:
        from_attributes = True
