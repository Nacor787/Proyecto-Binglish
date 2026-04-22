from typing import List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import User
from app.core.security import get_current_user, require_role
from app.schemas.pago import (
    ConsignaCreate,
    ConsignaOut,
    ConsignaUpdate,
    PagoEstudianteCreate,
    PagoEstudianteUpdate,
    PagoEstudianteOut,
    EstadoPagoEstudiante,
)
from app.services import pago_service

router = APIRouter(prefix="/pagos", tags=["Pagos"])


# ==================== CONSIGNAS (Catálogo) ====================

@router.get("/consignas", response_model=List[ConsignaOut])
def listar_consignas(
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role(["admin"])),
):
    """Lista todas las consignas de pago (admin)."""
    return pago_service.get_all_consignas(db)


@router.post("/consignas", response_model=ConsignaOut, status_code=201)
def crear_consigna(
    data: ConsignaCreate,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role(["admin"])),
):
    """Crea una nueva consigna de pago (admin)."""
    return pago_service.create_consigna(db, data.codigo, data.monto)


@router.put("/consignas/{consigna_id}", response_model=ConsignaOut)
def actualizar_consigna(
    consigna_id: int,
    data: ConsignaUpdate,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role(["admin"])),
):
    """Edita una consigna existente (admin)."""
    return pago_service.update_consigna(db, consigna_id, data.codigo, data.monto)


@router.delete("/consignas/{consigna_id}")
def eliminar_consigna(
    consigna_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role(["admin"])),
):
    """Elimina una consigna del catálogo (admin)."""
    pago_service.delete_consigna(db, consigna_id)
    return {"message": "Consigna eliminada correctamente"}


# ==================== PAGOS DE ESTUDIANTES ====================

@router.get("/", response_model=List[PagoEstudianteOut])
def listar_pagos(
    skip: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=500),
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role(["admin"])),
):
    """Lista todos los pagos asignados (admin)."""
    return pago_service.get_all_pagos(db, skip, limit)


@router.post("/", response_model=PagoEstudianteOut, status_code=201)
def asignar_pago(
    data: PagoEstudianteCreate,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role(["admin"])),
):
    """Asigna una consigna de pago a un estudiante (admin)."""
    return pago_service.asignar_pago(
        db, data.usuario_codigo, data.consigna_id, data.observacion
    )


@router.put("/{pago_id}", response_model=PagoEstudianteOut)
def actualizar_pago(
    pago_id: int,
    data: PagoEstudianteUpdate,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role(["admin"])),
):
    """Actualiza administrador un pago asignado (admin)."""
    return pago_service.update_pago_estado(
        db, pago_id, data.usuario_codigo, data.consigna_id, data.estado, data.observacion
    )


@router.delete("/{pago_id}")
def eliminar_pago(
    pago_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role(["admin"])),
):
    """Elimina un registro de pago (admin)."""
    pago_service.delete_pago(db, pago_id)
    return {"message": "Registro de pago eliminado correctamente"}


# ==================== ESTADO DEL ESTUDIANTE ====================

@router.get("/mi-estado", response_model=EstadoPagoEstudiante)
def mi_estado_pago(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Obtiene el estado de pago del estudiante autenticado."""
    return pago_service.verificar_estado_pago(db, current_user.id)
