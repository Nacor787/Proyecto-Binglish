from typing import List, Optional
from fastapi import APIRouter, Depends, Query, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import User
from app.core.security import get_current_user, require_role
from app.schemas.biblioteca import (
    CategoriaCreate, CategoriaUpdate, CategoriaOut,
    BibliotecaItemUpdate, BibliotecaItemOut, BibliotecaViewURL,
)
from app.services import biblioteca_service

router = APIRouter(prefix="/biblioteca", tags=["Biblioteca"])


# ==================== CATEGORÍAS ====================

@router.get("/categorias", response_model=List[CategoriaOut])
def listar_categorias(
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    """Lista todas las categorías de la biblioteca."""
    return biblioteca_service.get_all_categorias(db)


@router.post("/categorias", response_model=CategoriaOut, status_code=201)
def crear_categoria(
    data: CategoriaCreate,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role(["admin", "docente"])),
):
    """Crea una nueva categoría (admin o docente)."""
    return biblioteca_service.create_categoria(db, data.nombre, data.descripcion)


@router.put("/categorias/{cat_id}", response_model=CategoriaOut)
def actualizar_categoria(
    cat_id: int,
    data: CategoriaUpdate,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role(["admin", "docente"])),
):
    """Edita una categoría existente (admin o docente)."""
    return biblioteca_service.update_categoria(db, cat_id, data.nombre, data.descripcion)


@router.delete("/categorias/{cat_id}")
def eliminar_categoria(
    cat_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role(["admin"])),
):
    """Elimina una categoría (solo admin)."""
    biblioteca_service.delete_categoria(db, cat_id)
    return {"message": "Categoría eliminada correctamente"}


# ==================== ITEMS — LISTADO Y SUBIDA ====================

@router.get("/", response_model=List[BibliotecaItemOut])
def listar_items(
    categoria_id: Optional[int] = Query(None),
    curso_id: Optional[int] = Query(None),
    busqueda: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    """Lista los recursos de la biblioteca con filtros opcionales."""
    items = biblioteca_service.list_items(db, categoria_id, curso_id, busqueda)
    result = []
    for item in items:
        out = BibliotecaItemOut.model_validate(item)
        out.tiene_portada = item.portada_path is not None and item.portada_path != ""
        result.append(out)
    return result


@router.post("/upload", response_model=BibliotecaItemOut, status_code=201)
async def subir_recurso(
    titulo: str = Form(...),
    archivo: UploadFile = File(...),
    descripcion: Optional[str] = Form(None),
    categoria_id: Optional[int] = Form(None),
    curso_id: Optional[int] = Form(None),
    es_publico: bool = Form(False),
    portada: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "docente"])),
):
    """Sube un PDF a la biblioteca (admin o docente)."""
    item = await biblioteca_service.upload_item(
        db=db,
        titulo=titulo,
        archivo=archivo,
        user_id=current_user.id,
        descripcion=descripcion,
        categoria_id=categoria_id,
        curso_id=curso_id,
        es_publico=es_publico,
        portada=portada,
    )
    out = BibliotecaItemOut.model_validate(item)
    out.tiene_portada = item.portada_path is not None and item.portada_path != ""
    return out


# ==================== SUB-RUTAS CON /{item_id}/... (ANTES de /{item_id}) ====================

@router.get("/{item_id}/portada")
def obtener_portada(
    item_id: int,
    db: Session = Depends(get_db),
):
    """Sirve la imagen de portada de un recurso (público, no necesita JWT)."""
    import os
    item = db.query(biblioteca_service.BibliotecaItem).filter(
        biblioteca_service.BibliotecaItem.id == item_id
    ).first()
    if not item or not item.portada_path:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Portada no encontrada")
    if not os.path.exists(item.portada_path):
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Archivo de portada no encontrado")
    return FileResponse(item.portada_path)


@router.post("/{item_id}/portada")
async def actualizar_portada(
    item_id: int,
    portada: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "docente"])),
):
    """Actualiza la portada de un recurso existente (admin o autor)."""
    import os
    item = db.query(biblioteca_service.BibliotecaItem).filter(
        biblioteca_service.BibliotecaItem.id == item_id
    ).first()
    if not item:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recurso no encontrado")
    if current_user.rol.value != "admin" and item.subido_por != current_user.id:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permisos")

    # Eliminar portada anterior si existe
    if item.portada_path and os.path.exists(item.portada_path):
        os.remove(item.portada_path)

    # Guardar nueva portada
    import uuid
    contents = await portada.read()
    ext = portada.filename.rsplit(".", 1)[-1].lower() if "." in portada.filename else "jpg"
    file_id = str(uuid.uuid4())
    new_path = os.path.join(biblioteca_service.PORTADA_DIR, f"{file_id}.{ext}")
    with open(new_path, "wb") as f:
        f.write(contents)

    item.portada_path = new_path
    db.commit()
    return {"message": "Portada actualizada correctamente"}

@router.get("/{item_id}/view-url", response_model=BibliotecaViewURL)
def generar_url_visualizacion(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Genera una URL firmada temporal para visualizar el PDF."""
    item = biblioteca_service.get_item_by_id(db, item_id)
    if not item:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recurso no encontrado")
    if not biblioteca_service.check_access(db, item, current_user):
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes acceso a este recurso")
    return biblioteca_service.generate_signed_url(item_id, current_user.id)


@router.get("/{item_id}/view")
def ver_pdf(
    item_id: int,
    token: str = Query(...),
    db: Session = Depends(get_db),
):
    """Sirve el PDF usando un token firmado temporal. No requiere JWT header."""
    import os
    payload = biblioteca_service.verify_signed_token(token)
    if payload.get("item_id") != item_id:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Token no válido para este recurso")
    item = db.query(biblioteca_service.BibliotecaItem).filter(
        biblioteca_service.BibliotecaItem.id == item_id
    ).first()
    if not item:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recurso no encontrado")
    if not os.path.exists(item.archivo_path):
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Archivo no encontrado en el servidor")
    return FileResponse(
        path=item.archivo_path,
        media_type="application/pdf",
        headers={
            "Content-Disposition": "inline",
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "no-store, no-cache, must-revalidate",
        },
    )


# ==================== GENÉRICO /{item_id} — AL FINAL ====================

@router.get("/{item_id}", response_model=BibliotecaItemOut)
def obtener_item(
    item_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    """Obtiene detalle de un recurso."""
    item = biblioteca_service.get_item_by_id(db, item_id)
    if not item:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recurso no encontrado")
    out = BibliotecaItemOut.model_validate(item)
    out.tiene_portada = item.portada_path is not None and item.portada_path != ""
    return out


@router.put("/{item_id}", response_model=BibliotecaItemOut)
def actualizar_item(
    item_id: int,
    data: BibliotecaItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "docente"])),
):
    """Edita metadata de un recurso (admin o autor)."""
    item = biblioteca_service.update_item(
        db, item_id, current_user,
        data.titulo, data.descripcion, data.categoria_id, data.curso_id, data.es_publico,
    )
    out = BibliotecaItemOut.model_validate(item)
    out.tiene_portada = item.portada_path is not None and item.portada_path != ""
    return out


@router.delete("/{item_id}")
def eliminar_item(
    item_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role(["admin"])),
):
    """Elimina un recurso y sus archivos (solo admin)."""
    biblioteca_service.delete_item(db, item_id)
    return {"message": "Recurso eliminado correctamente"}
