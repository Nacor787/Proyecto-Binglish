from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import User, Grade, Course
from app.core.security import require_role
from app.services.reporte_service import generar_pdf, generar_excel, generar_csv

router = APIRouter(prefix="/reportes", tags=["Reportes"])


@router.get("/notas/{formato}")
def reporte_notas(
    formato: str,
    curso_id: int = Query(None, description="Filtrar por curso"),
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role(["admin", "docente"])),
):
    """
    Genera un reporte de notas en el formato especificado.

    Formatos soportados: **pdf**, **excel**, **csv**

    - **curso_id** (opcional): Filtrar notas por curso
    """
    # Obtener datos
    query = db.query(Grade).join(User, Grade.estudiante_id == User.id).join(Course, Grade.curso_id == Course.id)
    if curso_id:
        query = query.filter(Grade.curso_id == curso_id)
    notas = query.all()

    columnas = ["Código", "Estudiante", "Curso", "Overall Grade", "Status", "Fecha"]
    datos = []
    for n in notas:
        midterm = (n.midterm_reading or 0) + (n.midterm_listening or 0) + (n.midterm_writing or 0) + (n.midterm_speaking or 0) + (n.midterm_participation or 0) + (n.midterm_attendance or 0)
        final = (n.final_reading or 0) + (n.final_listening or 0) + (n.final_writing or 0) + (n.final_speaking or 0) + (n.final_participation or 0) + (n.final_attendance or 0)
        overall = int(round((midterm + final) / 2))
        
        datos.append([
            n.estudiante.codigo if n.estudiante else "N/A",
            f"{n.estudiante.nombre} {n.estudiante.apellido}" if n.estudiante else "N/A",
            n.curso.nombre if n.curso else "N/A",
            str(overall),
            "Approved" if n.is_passed else "Failed",
            n.fecha.strftime("%Y-%m-%d") if n.fecha else "",
        ])

    if formato == "pdf":
        buffer = generar_pdf("Reporte de Notas", columnas, datos)
        return StreamingResponse(
            buffer,
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=reporte_notas.pdf"},
        )
    elif formato == "excel":
        buffer = generar_excel("Reporte de Notas", columnas, datos)
        return StreamingResponse(
            buffer,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=reporte_notas.xlsx"},
        )
    elif formato == "csv":
        buffer = generar_csv(columnas, datos)
        return StreamingResponse(
            iter([buffer.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=reporte_notas.csv"},
        )
    else:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Formato no soportado. Usa: pdf, excel, csv",
        )


@router.get("/usuarios/{formato}")
def reporte_usuarios(
    formato: str,
    rol: str = Query(None, description="Filtrar por rol: admin, docente, estudiante"),
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role(["admin"])),
):
    """
    Genera un reporte de usuarios en el formato especificado.

    Formatos soportados: **pdf**, **excel**, **csv**
    """
    query = db.query(User)
    if rol:
        query = query.filter(User.rol == rol)
    usuarios = query.all()

    columnas = ["ID", "Código", "Nombre", "Apellido", "Rol", "Fecha Registro"]
    datos = []
    for u in usuarios:
        datos.append([
            u.id,
            u.codigo,
            u.nombre,
            u.apellido,
            u.rol.value,
            u.created_at.strftime("%Y-%m-%d") if u.created_at else "",
        ])

    if formato == "pdf":
        buffer = generar_pdf("Reporte de Usuarios", columnas, datos)
        return StreamingResponse(
            buffer,
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=reporte_usuarios.pdf"},
        )
    elif formato == "excel":
        buffer = generar_excel("Reporte de Usuarios", columnas, datos)
        return StreamingResponse(
            buffer,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=reporte_usuarios.xlsx"},
        )
    elif formato == "csv":
        buffer = generar_csv(columnas, datos)
        return StreamingResponse(
            iter([buffer.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=reporte_usuarios.csv"},
        )
    else:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Formato no soportado. Usa: pdf, excel, csv",
        )


@router.get("/pagos/{formato}")
def reporte_pagos(
    formato: str,
    codigo_estudiante: str = Query(None, description="Filtrar por código de estudiante"),
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role(["admin", "docente"])),
):
    """
    Genera un reporte de pagos en el formato especificado.
    
    Formatos soportados: **pdf**, **excel**, **csv**
    - **codigo_estudiante** (opcional): Filtrar pagos por estudiante
    """
    from app.db.models import StudentPayment, ConsignaPago
    from app.core.btrm_validator import validate_btrm_code
    
    query = db.query(StudentPayment).join(User, StudentPayment.usuario_id == User.id).join(ConsignaPago, StudentPayment.consigna_id == ConsignaPago.id)
    if codigo_estudiante:
        codigo_limpio = validate_btrm_code(codigo_estudiante)
        query = query.filter(User.codigo == codigo_limpio)
    
    pagos = query.order_by(StudentPayment.fecha_asignacion.desc()).all()

    columnas = ["Cód. Estudiante", "Nombre Completo", "Consigna", "Monto", "Estado", "Último Pago", "Fecha Asignación"]
    datos = []
    for p in pagos:
        datos.append([
            p.estudiante.codigo if p.estudiante else "N/A",
            f"{p.estudiante.nombre} {p.estudiante.apellido}" if p.estudiante else "N/A",
            p.consigna.codigo if p.consigna else "N/A",
            float(p.consigna.monto) if p.consigna else 0,
            p.estado.upper(),
            p.fecha_pago.strftime("%Y-%m-%d") if p.fecha_pago else "N/A",
            p.fecha_asignacion.strftime("%Y-%m-%d") if p.fecha_asignacion else "N/A"
        ])

    if formato == "pdf":
        buffer = generar_pdf("Reporte de Pagos", columnas, datos)
        return StreamingResponse(
            buffer,
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=reporte_pagos.pdf"},
        )
    elif formato == "excel":
        buffer = generar_excel("Reporte de Pagos", columnas, datos)
        return StreamingResponse(
            buffer,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=reporte_pagos.xlsx"},
        )
    elif formato == "csv":
        buffer = generar_csv(columnas, datos)
        return StreamingResponse(
            iter([buffer.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=reporte_pagos.csv"},
        )
    else:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Formato no soportado. Usa: pdf, excel, csv",
        )
