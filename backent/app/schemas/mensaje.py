from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class MensajeUserInfo(BaseModel):
    codigo: str
    nombre: str
    apellido: str

    class Config:
        from_attributes = True


class MensajeCreate(BaseModel):
    titulo: str
    contenido: str
    destinatario_codigo: Optional[str] = None


class MensajeOut(BaseModel):
    id: int
    titulo: str
    contenido: str
    autor_id: int
    destinatario_id: Optional[int] = None
    destinatario: Optional[MensajeUserInfo] = None
    leido: bool = False
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class MensajeConteo(BaseModel):
    total: int
    no_leidos: int
