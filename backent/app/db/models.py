from sqlalchemy import (
    Column, Integer, String, Float, Text, Boolean, ForeignKey, DateTime, Enum as SAEnum, Numeric
)
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import enum

from app.db.database import Base


# ---------- Enums ----------

class RolEnum(str, enum.Enum):
    admin = "admin"
    docente = "docente"
    estudiante = "estudiante"


# ---------- Modelos ----------

class User(Base):
    __tablename__ = "usuarios"

    id = Column(Integer, primary_key=True, index=True)
    codigo = Column(String(50), unique=True, index=True, nullable=False)
    nombre = Column(String(100), nullable=False)
    apellido = Column(String(100), nullable=False)
    direccion = Column(String(150), nullable=True)
    telefono = Column(String(20), nullable=True)
    telefono_emergencia = Column(String(50), nullable=True)
    hashed_password = Column(String(255), nullable=False)
    rol = Column(SAEnum(RolEnum), nullable=False, default=RolEnum.estudiante)
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relaciones
    cursos_docente = relationship("Course", back_populates="docente", foreign_keys="Course.docente_id")
    inscripciones = relationship("StudentCourse", back_populates="estudiante")
    notas = relationship("Grade", back_populates="estudiante", foreign_keys="Grade.estudiante_id")
    mensajes_enviados = relationship("Message", back_populates="autor", foreign_keys="Message.autor_id")
    mensajes_recibidos = relationship("Message", back_populates="destinatario", foreign_keys="Message.destinatario_id")
    pagos_asignados = relationship("StudentPayment", back_populates="estudiante", foreign_keys="StudentPayment.usuario_id")
    biblioteca_items = relationship("BibliotecaItem", back_populates="autor", foreign_keys="BibliotecaItem.subido_por")


class CategoriaNivel(Base):
    __tablename__ = "niveles"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(50), unique=True, nullable=False)

    cursos = relationship("Course", back_populates="nivel")


class CategoriaModalidad(Base):
    __tablename__ = "modalidades"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(50), unique=True, nullable=False)

    cursos = relationship("Course", back_populates="modalidad")


class Course(Base):
    __tablename__ = "cursos"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(150), nullable=False)
    descripcion = Column(Text, nullable=True)
    docente_id = Column(Integer, ForeignKey("usuarios.id"), nullable=True)
    nivel_id = Column(Integer, ForeignKey("niveles.id", ondelete="SET NULL"), nullable=True)
    modalidad_id = Column(Integer, ForeignKey("modalidades.id", ondelete="SET NULL"), nullable=True)
    hora_inicio = Column(String(20), nullable=True)
    hora_fin = Column(String(20), nullable=True)
    dias = Column(String(100), nullable=True)
    horas_semanales = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relaciones
    docente = relationship("User", back_populates="cursos_docente", foreign_keys=[docente_id])
    estudiantes = relationship("StudentCourse", back_populates="curso")
    notas = relationship("Grade", back_populates="curso")
    nivel = relationship("CategoriaNivel", back_populates="cursos")
    modalidad = relationship("CategoriaModalidad", back_populates="cursos")


class StudentCourse(Base):
    __tablename__ = "estudiantes_cursos"

    id = Column(Integer, primary_key=True, index=True)
    estudiante_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    curso_id = Column(Integer, ForeignKey("cursos.id"), nullable=False)
    fecha_inscripcion = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relaciones
    estudiante = relationship("User", back_populates="inscripciones")
    curso = relationship("Course", back_populates="estudiantes")


class Grade(Base):
    __tablename__ = "notas"

    id = Column(Integer, primary_key=True, index=True)
    estudiante_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    curso_id = Column(Integer, ForeignKey("cursos.id"), nullable=False)
    
    # Midterm Assessment (Max 100)
    midterm_reading = Column(Integer, default=0) # /20
    midterm_listening = Column(Integer, default=0) # /20
    midterm_writing = Column(Integer, default=0) # /15
    midterm_speaking = Column(Integer, default=0) # /15
    midterm_participation = Column(Integer, default=0) # /15
    midterm_attendance = Column(Integer, default=0) # /15
    midterm_comment = Column(Text, nullable=True)

    # Final Assessment (Max 100)
    final_reading = Column(Integer, default=0) # /20
    final_listening = Column(Integer, default=0) # /20
    final_writing = Column(Integer, default=0) # /15
    final_speaking = Column(Integer, default=0) # /15
    final_participation = Column(Integer, default=0) # /15
    final_attendance = Column(Integer, default=0) # /15
    final_comment = Column(Text, nullable=True)

    # Metadata & Results
    recommended_level = Column(String(100), nullable=True)
    ending_date = Column(String(50), nullable=True)
    is_passed = Column(Boolean, default=True)
    
    fecha = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relaciones
    estudiante = relationship("User", back_populates="notas", foreign_keys=[estudiante_id])
    curso = relationship("Course", back_populates="notas")


class Message(Base):
    __tablename__ = "mensajes"

    id = Column(Integer, primary_key=True, index=True)
    titulo = Column(String(200), nullable=False)
    contenido = Column(Text, nullable=False)
    autor_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    destinatario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=True)
    leido = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relaciones
    autor = relationship("User", back_populates="mensajes_enviados", foreign_keys=[autor_id])
    destinatario = relationship("User", back_populates="mensajes_recibidos", foreign_keys=[destinatario_id])


class MessageRead(Base):
    """Tabla asociativa para registrar qué usuarios han leído los mensajes generales."""
    __tablename__ = "mensajes_leidos"

    id = Column(Integer, primary_key=True, index=True)
    mensaje_id = Column(Integer, ForeignKey("mensajes.id", ondelete="CASCADE"), nullable=False)
    usuario_id = Column(Integer, ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)
    fecha_leido = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relaciones (opcional, pero útil si se requiere ORM a futuro)
    mensaje = relationship("Message", backref="lecturas")
    usuario = relationship("User", backref="mensajes_leidos_gral")

class ConsignaPago(Base):
    __tablename__ = "consignas_pago"

    id = Column(Integer, primary_key=True, index=True)
    codigo = Column(String(5), unique=True, nullable=False)
    monto = Column(Numeric(10, 2), nullable=False)

    # Relaciones
    estudiantes_asignados = relationship("StudentPayment", back_populates="consigna")


class StudentPayment(Base):
    """Modelo intermedio para asociar un tipo de consigna de pago con un estudiante."""
    __tablename__ = "pagos_estudiantes"

    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)
    consigna_id = Column(Integer, ForeignKey("consignas_pago.id", ondelete="CASCADE"), nullable=False)
    estado = Column(String(20), default="pendiente")
    fecha_asignacion = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    fecha_pago = Column(DateTime, nullable=True)
    observacion = Column(String(255), nullable=True)

    # Relaciones
    estudiante = relationship("User", back_populates="pagos_asignados", foreign_keys=[usuario_id])
    consigna = relationship("ConsignaPago", back_populates="estudiantes_asignados")


class CategoriaBiblioteca(Base):
    """Categorías para organizar los recursos de la biblioteca virtual."""
    __tablename__ = "categorias_biblioteca"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(100), unique=True, nullable=False)
    descripcion = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relaciones
    items = relationship("BibliotecaItem", back_populates="categoria")


class BibliotecaItem(Base):
    """Recurso de la biblioteca virtual (PDF, documento, etc.)."""
    __tablename__ = "biblioteca"

    id = Column(Integer, primary_key=True, index=True)
    titulo = Column(String(255), nullable=False)
    descripcion = Column(Text, nullable=True)
    archivo_path = Column(String(500), nullable=False)
    portada_path = Column(String(500), nullable=True)
    categoria_id = Column(Integer, ForeignKey("categorias_biblioteca.id", ondelete="SET NULL"), nullable=True)
    curso_id = Column(Integer, ForeignKey("cursos.id", ondelete="SET NULL"), nullable=True)
    subido_por = Column(Integer, ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True)
    es_publico = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relaciones
    categoria = relationship("CategoriaBiblioteca", back_populates="items")
    curso = relationship("Course")
    autor = relationship("User", back_populates="biblioteca_items", foreign_keys=[subido_por])

