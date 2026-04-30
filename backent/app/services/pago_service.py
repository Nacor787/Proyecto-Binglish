from typing import List, Optional
from datetime import datetime, timezone
from sqlalchemy.orm import Session, joinedload
from fastapi import HTTPException, status

from app.db.models import ConsignaPago, StudentPayment, User


# ==================== CONSIGNAS (Catálogo) ====================

def get_all_consignas(db: Session) -> List[ConsignaPago]:
    """Lista todas las consignas de pago."""
    return db.query(ConsignaPago).order_by(ConsignaPago.codigo).all()


def get_consigna_by_id(db: Session, consigna_id: int) -> Optional[ConsignaPago]:
    return db.query(ConsignaPago).filter(ConsignaPago.id == consigna_id).first()


def create_consigna(db: Session, codigo: str, monto: float) -> ConsignaPago:
    """Crea una nueva consigna de pago."""
    existing = db.query(ConsignaPago).filter(ConsignaPago.codigo == codigo).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ya existe una consigna con código '{codigo}'",
        )
    consigna = ConsignaPago(codigo=codigo, monto=monto)
    db.add(consigna)
    db.commit()
    db.refresh(consigna)
    return consigna


def update_consigna(db: Session, consigna_id: int, codigo: Optional[str] = None, monto: Optional[float] = None) -> ConsignaPago:
    consigna = get_consigna_by_id(db, consigna_id)
    if not consigna:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Consigna no encontrada",
        )
    
    if codigo is not None:
        existing = db.query(ConsignaPago).filter(ConsignaPago.codigo == codigo).first()
        if existing and existing.id != consigna_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Ya existe otra consigna con código '{codigo}'",
            )
        consigna.codigo = codigo
        
    if monto is not None:
        consigna.monto = monto

    db.commit()
    db.refresh(consigna)
    return consigna


def delete_consigna(db: Session, consigna_id: int) -> bool:
    """Elimina una consigna del catálogo."""
    consigna = get_consigna_by_id(db, consigna_id)
    if not consigna:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Consigna no encontrada",
        )
    db.delete(consigna)
    db.commit()
    return True


# ==================== PAGOS DE ESTUDIANTES ====================

def get_all_pagos(db: Session, skip: int = 0, limit: int = 200) -> List[StudentPayment]:
    """Lista todos los pagos asignados (admin)."""
    return (
        db.query(StudentPayment)
        .options(joinedload(StudentPayment.consigna), joinedload(StudentPayment.estudiante))
        .order_by(StudentPayment.fecha_asignacion.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_pagos_by_usuario(db: Session, usuario_id: int) -> List[StudentPayment]:
    """Obtiene los pagos de un estudiante específico."""
    return (
        db.query(StudentPayment)
        .options(joinedload(StudentPayment.consigna), joinedload(StudentPayment.estudiante))
        .filter(StudentPayment.usuario_id == usuario_id)
        .order_by(StudentPayment.fecha_asignacion.desc())
        .all()
    )


def asignar_pago(
    db: Session,
    usuario_codigo: str,
    consigna_id: int,
    observacion: Optional[str] = None,
) -> StudentPayment:
    """Asigna una consigna de pago a un estudiante."""
    consigna = get_consigna_by_id(db, consigna_id)
    if not consigna:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Consigna no encontrada",
        )

    usuario = db.query(User).filter(User.codigo == usuario_codigo).first()
    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Estudiante no encontrado por código",
        )

    pago = StudentPayment(
        usuario_id=usuario.id,
        consigna_id=consigna_id,
        estado="pendiente",
        observacion=observacion,
    )
    db.add(pago)
    db.commit()
    db.refresh(pago)
    # Cargar relación consigna y estudiante para la respuesta
    db.refresh(pago, attribute_names=["consigna", "estudiante"])
    return pago


def update_pago_estado(
    db: Session,
    pago_id: int,
    usuario_codigo: Optional[str] = None,
    consigna_id: Optional[int] = None,
    estado: Optional[str] = None,
    observacion: Optional[str] = None,
) -> StudentPayment:
    """Actualiza los datos de un pago asignado."""
    pago = db.query(StudentPayment).filter(StudentPayment.id == pago_id).first()
    if not pago:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Registro de pago no encontrado",
        )

    if usuario_codigo is not None:
        usuario = db.query(User).filter(User.codigo == usuario_codigo).first()
        if not usuario:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Estudiante no encontrado por código",
            )
        pago.usuario_id = usuario.id

    if consigna_id is not None:
        consigna = get_consigna_by_id(db, consigna_id)
        if not consigna:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Consigna no encontrada",
            )
        pago.consigna_id = consigna_id

    if estado is not None:
        pago.estado = estado
        # Si se marca como pagado, registrar fecha de pago
        if estado == "pagado":
            pago.fecha_pago = datetime.now(timezone.utc)
        elif estado == "pendiente":
            pago.fecha_pago = None

    if observacion is not None:
        pago.observacion = observacion

    db.commit()
    db.refresh(pago)
    return pago


def delete_pago(db: Session, pago_id: int) -> bool:
    """Elimina un registro de pago."""
    pago = db.query(StudentPayment).filter(StudentPayment.id == pago_id).first()
    if not pago:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Registro de pago no encontrado",
        )
    db.delete(pago)
    db.commit()
    return True


# ==================== VERIFICACIÓN DE ESTADO ====================

def verificar_estado_pago(db: Session, usuario_id: int) -> dict:
    """
    Verifica si un estudiante está al día con sus pagos.
    - Si no tiene registros → registrado=False, al_dia=False
    - Si tiene al menos un pago pendiente/vencido → al_dia=False
    - Si todos sus pagos están 'pagado' → al_dia=True
    """
    pagos = get_pagos_by_usuario(db, usuario_id)

    if not pagos:
        return {
            "registrado": False,
            "al_dia": False,
            "deuda_pendiente": 0.0,
            "pagos": [],
        }

    deuda = sum(
        float(p.consigna.monto)
        for p in pagos
        if p.estado in ("pendiente", "vencido")
    )

    return {
        "registrado": True,
        "al_dia": deuda == 0,
        "deuda_pendiente": deuda,
        "pagos": pagos,
    }
