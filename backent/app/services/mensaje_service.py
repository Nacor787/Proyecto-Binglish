from typing import List, Optional
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from fastapi import HTTPException, status

from app.db.models import Message, MessageRead
from app.schemas.mensaje import MensajeCreate

def get_mensajes_recibidos(db: Session, user_id: int) -> List[Message]:
    """Obtiene mensajes dirigidos a un usuario o mensajes generales (sin destinatario) resolviendo la lectura."""
    mensajes = db.query(Message).options(joinedload(Message.destinatario)).filter(
        (Message.destinatario_id == user_id) | (Message.destinatario_id.is_(None))
    ).order_by(Message.created_at.desc()).all()

    # Buscar qué mensajes generales ya leyó el usuario
    global_reads = db.query(MessageRead.mensaje_id).filter(MessageRead.usuario_id == user_id).all()
    read_ids = {r[0] for r in global_reads}

    for m in mensajes:
        if m.destinatario_id is None:
            # Sobrescribir el campo de SQLAlchemy antes de devolverlo a Pydantic
            m.leido = m.id in read_ids

    return mensajes

def get_mensajes_enviados(db: Session, autor_id: int) -> List[Message]:
    """Obtiene mensajes enviados por un usuario."""
    return db.query(Message).options(joinedload(Message.destinatario)).filter(
        Message.autor_id == autor_id
    ).order_by(Message.created_at.desc()).all()

def get_all_mensajes(db: Session, skip: int = 0, limit: int = 100) -> List[Message]:
    """Lista todos los mensajes (solo admin debe ver todos)."""
    return db.query(Message).options(joinedload(Message.destinatario)).order_by(Message.created_at.desc()).offset(skip).limit(limit).all()

def get_mensajes_docente(db: Session, docente_id: int, skip: int = 0, limit: int = 100) -> List[Message]:
    """Lista los mensajes que el docente puede ver: generales, enviados por él, y enviados a él."""
    return db.query(Message).options(joinedload(Message.destinatario)).filter(
        (Message.destinatario_id.is_(None)) |
        (Message.autor_id == docente_id) |
        (Message.destinatario_id == docente_id)
    ).order_by(Message.created_at.desc()).offset(skip).limit(limit).all()

def get_mensaje_by_id(db: Session, mensaje_id: int) -> Optional[Message]:
    """Obtiene un mensaje por su ID."""
    return db.query(Message).options(joinedload(Message.destinatario)).filter(Message.id == mensaje_id).first()



def create_mensaje(db: Session, mensaje_data: MensajeCreate, autor_id: int, destinatario_id: Optional[int] = None) -> Message:
    """Crea un nuevo mensaje/aviso."""
    db_mensaje = Message(
        titulo=mensaje_data.titulo,
        contenido=mensaje_data.contenido,
        autor_id=autor_id,
        destinatario_id=destinatario_id,
    )
    db.add(db_mensaje)
    db.commit()
    db.refresh(db_mensaje)
    return db_mensaje


def delete_mensaje(db: Session, mensaje_id: int) -> bool:
    """Elimina un mensaje por ID y las lecturas asociadas para evitar conflictos de llave foránea."""
    from app.db.models import MessageRead
    db_mensaje = get_mensaje_by_id(db, mensaje_id)
    if not db_mensaje:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mensaje no encontrado",
        )
    # Primero eliminar referencias en mensajes_leidos
    db.query(MessageRead).filter(MessageRead.mensaje_id == mensaje_id).delete(synchronize_session=False)
    
    # Luego eliminar el mensaje
    db.delete(db_mensaje)
    db.commit()
    return True


def get_conteo_mensajes(db: Session, user_id: int) -> dict:
    """Obtiene el conteo total y no leídos de mensajes para un usuario."""
    mensajes = get_mensajes_recibidos(db, user_id)
    total = len(mensajes)
    no_leidos = sum(1 for m in mensajes if getattr(m, 'leido', False) == False)
    return {"total": total, "no_leidos": no_leidos}


def get_conteo_mensajes_admin(db: Session) -> dict:
    """Obtiene el conteo total y no leídos de todos los mensajes (admin)."""
    total = db.query(func.count(Message.id)).scalar()
    no_leidos = db.query(func.count(Message.id)).filter(Message.leido == False).scalar()
    return {"total": total, "no_leidos": no_leidos}


def marcar_como_leidos(db: Session, user_id: int) -> int:
    """Marca todos los mensajes del usuario como leídos. Retorna cantidad actualizada."""
    # 1. Mensajes Directos
    count_direct = db.query(Message).filter(
        Message.destinatario_id == user_id,
        Message.leido == False
    ).update({Message.leido: True}, synchronize_session="fetch")
    
    # 2. Mensajes Generales
    mensajes_generales = db.query(Message).filter(Message.destinatario_id.is_(None)).all()
    global_reads = db.query(MessageRead.mensaje_id).filter(MessageRead.usuario_id == user_id).all()
    read_ids = {r[0] for r in global_reads}
    
    count_general = 0
    for mg in mensajes_generales:
        if mg.id not in read_ids:
            db.add(MessageRead(mensaje_id=mg.id, usuario_id=user_id))
            count_general += 1

    db.commit()
    return count_direct + count_general


def marcar_mensaje_leido(db: Session, mensaje_id: int, user_id: int) -> Message:
    """Marca un mensaje individual como leído para el usuario proporcionado."""
    mensaje = get_mensaje_by_id(db, mensaje_id)
    if not mensaje:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mensaje no encontrado",
        )
    
    if mensaje.destinatario_id is None:
        read = db.query(MessageRead).filter_by(mensaje_id=mensaje.id, usuario_id=user_id).first()
        if not read:
            db.add(MessageRead(mensaje_id=mensaje.id, usuario_id=user_id))
            db.commit()
        mensaje.leido = True
    else:
        mensaje.leido = True
        db.commit()
        db.refresh(mensaje)
    return mensaje
