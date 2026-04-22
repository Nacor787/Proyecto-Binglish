from typing import List
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import User
from app.core.security import get_current_user, require_role
from app.core.btrm_validator import validate_btrm_code
from app.schemas.nota import NotaCreate, NotaUpdate, NotaOut
from app.services import nota_service
from app.services.user_service import get_user_by_codigo
from app.utils.pdf_generator import generar_pdf_notas_estudiante

router = APIRouter(prefix="/notas", tags=["Notas"])


@router.get("/", response_model=List[NotaOut])
def listar_todas_notas(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role(["admin", "docente"])),
):
    """Lista todas las notas (admin o docente)."""
    return nota_service.get_all_notas(db, skip, limit)


@router.get("/mis-notas", response_model=List[NotaOut])
def mis_notas(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Obtiene las notas del estudiante autenticado."""
    return nota_service.get_notas_by_estudiante(db, current_user.id)


@router.get("/mis-notas/pdf")
def descargar_mis_notas_pdf(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Descarga el Report Card detallado del estudiante autenticado."""
    notas_db = nota_service.get_notas_by_estudiante(db, current_user.id)
    if not notas_db:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="No tienes notas registradas para generar el reporte.")
    
    # Tomamos la nota más reciente o la primera para el reporte (Binglish suele manejar uno por curso)
    n = notas_db[-1] 
    
    # Preparar datos extendidos para el generador de PDF
    report_data = {
        "student_name": f"{current_user.nombre} {current_user.apellido}",
        "student_code": current_user.codigo,
        "course_name": n.curso.nombre if n.curso else "N/A",
        "teacher_name": f"{n.curso.docente.nombre} {n.curso.docente.apellido}" if n.curso and n.curso.docente else "N/A",
        "level": n.curso.nivel.nombre if n.curso and n.curso.nivel else "N/A",
        "schedule": f"{n.curso.hora_inicio} - {n.curso.hora_fin} ({n.curso.dias})" if n.curso else "N/A",
        "ending_date": n.ending_date or "N/A",
        "recommended_level": n.recommended_level or "N/A",
        "is_passed": n.is_passed,
        "midterm": {
            "reading": n.midterm_reading,
            "listening": n.midterm_listening,
            "writing": n.midterm_writing,
            "speaking": n.midterm_speaking,
            "participation": n.midterm_participation,
            "attendance": n.midterm_attendance,
            "comment": n.midterm_comment or ""
        },
        "final": {
            "reading": n.final_reading,
            "listening": n.final_listening,
            "writing": n.final_writing,
            "speaking": n.final_speaking,
            "participation": n.final_participation,
            "attendance": n.final_attendance,
            "comment": n.final_comment or ""
        }
    }

    pdf_buffer = generar_pdf_notas_estudiante(report_data)
    
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=mis_notas_{current_user.codigo}_{n.curso.nombre}.pdf"},
    )


@router.get("/{nota_id}/pdf")
def descargar_nota_especifica_pdf(
    nota_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Descarga el Report Card de una nota específica por su ID."""
    n = nota_service.get_nota_by_id(db, nota_id)
    if not n:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Nota no encontrada.")

    # Seguridad: Solo el dueño, admin o docente pueden descargar
    if current_user.rol == "estudiante" and n.estudiante_id != current_user.id:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="No tienes permiso para descargar esta nota.")

    # Preparar datos para el generador
    report_data = {
        "student_name": f"{n.estudiante.nombre} {n.estudiante.apellido}",
        "student_code": n.estudiante.codigo,
        "course_name": n.curso.nombre if n.curso else "N/A",
        "teacher_name": f"{n.curso.docente.nombre} {n.curso.docente.apellido}" if n.curso and n.curso.docente else "N/A",
        "level": n.curso.nivel.nombre if n.curso and n.curso.nivel else "N/A",
        "schedule": f"{n.curso.hora_inicio} - {n.curso.hora_fin} ({n.curso.dias})" if n.curso else "N/A",
        "ending_date": n.ending_date or "N/A",
        "recommended_level": n.recommended_level or "N/A",
        "is_passed": n.is_passed,
        "midterm": {
            "reading": n.midterm_reading,
            "listening": n.midterm_listening,
            "writing": n.midterm_writing,
            "speaking": n.midterm_speaking,
            "participation": n.midterm_participation,
            "attendance": n.midterm_attendance,
            "comment": n.midterm_comment or ""
        },
        "final": {
            "reading": n.final_reading,
            "listening": n.final_listening,
            "writing": n.final_writing,
            "speaking": n.final_speaking,
            "participation": n.final_participation,
            "attendance": n.final_attendance,
            "comment": n.final_comment or ""
        }
    }

    pdf_buffer = generar_pdf_notas_estudiante(report_data)
    
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=mis_notas_{n.estudiante.codigo}_{n.curso.nombre.replace(' ', '_')}.pdf"},
    )


@router.get("/estudiante/codigo/{codigo}", response_model=List[NotaOut])
def notas_por_codigo_btrm(
    codigo: str,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role(["admin", "docente"])),
):
    """Obtiene las notas de un estudiante por código BTRM-### (admin o docente)."""
    codigo_clean = validate_btrm_code(codigo)
    user = get_user_by_codigo(db, codigo_clean)
    if not user:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No se encontró estudiante con código {codigo_clean}",
        )
    return nota_service.get_notas_by_estudiante(db, user.id)


@router.get("/estudiante/{estudiante_id}", response_model=List[NotaOut])
def notas_por_estudiante(
    estudiante_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role(["admin", "docente"])),
):
    """Obtiene las notas de un estudiante específico por ID (admin o docente)."""
    return nota_service.get_notas_by_estudiante(db, estudiante_id)


@router.get("/curso/{curso_id}", response_model=List[NotaOut])
def notas_por_curso(
    curso_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role(["admin", "docente"])),
):
    """Obtiene las notas de un curso (admin o docente)."""
    return nota_service.get_notas_by_curso(db, curso_id)


@router.post("/", response_model=NotaOut, status_code=201)
def registrar_nota(
    nota_data: NotaCreate,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role(["admin", "docente"])),
):
    """Registra una nueva nota (admin o docente)."""
    codigo_clean = validate_btrm_code(nota_data.estudiante_codigo)
    user = get_user_by_codigo(db, codigo_clean)
    if not user:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No se encontró estudiante con código {codigo_clean}",
        )
    
    return nota_service.create_nota(db, nota_data, user.id)


@router.put("/{nota_id}", response_model=NotaOut)
def actualizar_nota(
    nota_id: int,
    nota_data: NotaUpdate,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role(["admin", "docente"])),
):
    """Actualiza una nota existente (admin o docente)."""
    return nota_service.update_nota(db, nota_id, nota_data)


@router.delete("/{nota_id}")
def eliminar_nota(
    nota_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role(["admin", "docente"])),
):
    """Elimina una nota (admin o docente)."""
    nota_service.delete_nota(db, nota_id)
    return {"message": "Nota eliminada correctamente"}
