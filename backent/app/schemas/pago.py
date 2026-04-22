from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from decimal import Decimal


# ---------- Consignas (Catálogo) ----------

class ConsignaCreate(BaseModel):
    codigo: str
    monto: float


class ConsignaUpdate(BaseModel):
    codigo: Optional[str] = None
    monto: Optional[float] = None


class ConsignaOut(BaseModel):
    id: int
    codigo: str
    monto: float

    class Config:
        from_attributes = True


# ---------- Pagos de Estudiantes ----------

class PagoEstudianteCreate(BaseModel):
    usuario_codigo: str
    consigna_id: int
    observacion: Optional[str] = None


class PagoEstudianteUpdate(BaseModel):
    usuario_codigo: Optional[str] = None
    consigna_id: Optional[int] = None
    estado: Optional[str] = None
    observacion: Optional[str] = None


class PagoConsignaInfo(BaseModel):
    id: int
    codigo: str
    monto: float

    class Config:
        from_attributes = True


class PagoEstudianteInfo(BaseModel):
    id: int
    codigo: str
    nombre: str
    apellido: str

    class Config:
        from_attributes = True

class PagoEstudianteOut(BaseModel):
    id: int
    usuario_id: int
    estudiante: Optional[PagoEstudianteInfo] = None
    consigna_id: int
    consigna: PagoConsignaInfo
    estado: str
    fecha_asignacion: Optional[datetime] = None
    fecha_pago: Optional[datetime] = None
    observacion: Optional[str] = None

    class Config:
        from_attributes = True


# ---------- Estado del Estudiante ----------

class EstadoPagoEstudiante(BaseModel):
    """Respuesta para el endpoint /pagos/mi-estado"""
    registrado: bool
    al_dia: bool
    deuda_pendiente: float
    pagos: List[PagoEstudianteOut]
