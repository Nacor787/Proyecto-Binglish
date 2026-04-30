from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional
from datetime import datetime
import re

CODE_PATTERN = re.compile(r"^(BTRM|ADM|TCH)-\d+$")


def _validate_btrm(v: str) -> str:
    """Valida que el código tenga formato PREFIJO-### (BTRM-204, ADM-1, TCH-100)."""
    clean = v.strip().upper()
    if not CODE_PATTERN.match(clean):
        raise ValueError(
            f"Formato inválido: '{v}'. Use el formato PREFIJO-### (ejemplos: BTRM-204, ADM-1, TCH-100)."
        )
    return clean



# ---------- Auth ----------

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    codigo: str
    password: str

    @field_validator("codigo")
    @classmethod
    def validate_codigo(cls, v: str) -> str:
        return _validate_btrm(v)


# ---------- User ----------

class UserCreate(BaseModel):
    codigo: str
    nombre: str
    apellido: str
    direccion: Optional[str] = None
    telefono: Optional[str] = None
    telefono_emergencia: Optional[str] = None
    password: str
    rol: str = "estudiante"
    activo: Optional[bool] = True

    @field_validator("codigo")
    @classmethod
    def validate_codigo(cls, v: str) -> str:
        return _validate_btrm(v)

    @field_validator("rol")
    @classmethod
    def validate_rol(cls, v):
        if v not in ["estudiante", "docente", "admin"]:
            raise ValueError("Rol inválido")
        return v


class UserUpdate(BaseModel):
    codigo: Optional[str] = None
    nombre: Optional[str] = None
    apellido: Optional[str] = None
    direccion: Optional[str] = None
    telefono: Optional[str] = None
    telefono_emergencia: Optional[str] = None
    password: Optional[str] = None
    rol: Optional[str] = None
    activo: Optional[bool] = None


class UserOut(BaseModel):
    id: int
    codigo: str
    nombre: str
    apellido: str
    direccion: Optional[str] = None
    telefono: Optional[str] = None
    telefono_emergencia: Optional[str] = None
    rol: str
    activo: bool
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
