from pydantic import BaseModel
from typing import Optional
from datetime import datetime


# ---------- Categorías ----------

class CategoriaCreate(BaseModel):
    nombre: str
    descripcion: Optional[str] = None


class CategoriaUpdate(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None


class CategoriaOut(BaseModel):
    id: int
    nombre: str
    descripcion: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ---------- Items de Biblioteca ----------

class BibliotecaItemCreate(BaseModel):
    """Metadata del item. El archivo se envía como Form/multipart."""
    titulo: str
    descripcion: Optional[str] = None
    categoria_id: Optional[int] = None
    curso_id: Optional[int] = None
    es_publico: bool = False


class BibliotecaItemUpdate(BaseModel):
    titulo: Optional[str] = None
    descripcion: Optional[str] = None
    categoria_id: Optional[int] = None
    curso_id: Optional[int] = None
    es_publico: Optional[bool] = None


class BibliotecaCursoInfo(BaseModel):
    id: int
    nombre: str

    class Config:
        from_attributes = True


class BibliotecaCategoriaInfo(BaseModel):
    id: int
    nombre: str

    class Config:
        from_attributes = True


class BibliotecaAutorInfo(BaseModel):
    id: int
    nombre: str
    apellido: str
    codigo: str

    class Config:
        from_attributes = True


class BibliotecaItemOut(BaseModel):
    id: int
    titulo: str
    descripcion: Optional[str] = None
    categoria_id: Optional[int] = None
    categoria: Optional[BibliotecaCategoriaInfo] = None
    curso_id: Optional[int] = None
    curso: Optional[BibliotecaCursoInfo] = None
    subido_por: Optional[int] = None
    autor: Optional[BibliotecaAutorInfo] = None
    es_publico: bool = False
    tiene_portada: bool = False
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class BibliotecaViewURL(BaseModel):
    url: str
    expires_in: int  # segundos
