from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class NotaCreate(BaseModel):
    estudiante_codigo: str
    curso_id: int
    
    # Midterm
    midterm_reading: int = 0
    midterm_listening: int = 0
    midterm_writing: int = 0
    midterm_speaking: int = 0
    midterm_participation: int = 0
    midterm_attendance: int = 0
    midterm_comment: Optional[str] = None

    # Final
    final_reading: int = 0
    final_listening: int = 0
    final_writing: int = 0
    final_speaking: int = 0
    final_participation: int = 0
    final_attendance: int = 0
    final_comment: Optional[str] = None

    recommended_level: Optional[str] = None
    ending_date: Optional[str] = None
    is_passed: bool = True


class NotaUpdate(BaseModel):
    # Midterm
    midterm_reading: Optional[int] = None
    midterm_listening: Optional[int] = None
    midterm_writing: Optional[int] = None
    midterm_speaking: Optional[int] = None
    midterm_participation: Optional[int] = None
    midterm_attendance: Optional[int] = None
    midterm_comment: Optional[str] = None

    # Final
    final_reading: Optional[int] = None
    final_listening: Optional[int] = None
    final_writing: Optional[int] = None
    final_speaking: Optional[int] = None
    final_participation: Optional[int] = None
    final_attendance: Optional[int] = None
    final_comment: Optional[str] = None

    recommended_level: Optional[str] = None
    ending_date: Optional[str] = None
    is_passed: Optional[bool] = None


class NotaOut(BaseModel):
    id: int
    estudiante_id: int
    curso_id: int
    
    midterm_reading: int
    midterm_listening: int
    midterm_writing: int
    midterm_speaking: int
    midterm_participation: int
    midterm_attendance: int
    midterm_comment: Optional[str]
    
    final_reading: int
    final_listening: int
    final_writing: int
    final_speaking: int
    final_participation: int
    final_attendance: int
    final_comment: Optional[str]
    
    recommended_level: Optional[str]
    ending_date: Optional[str]
    is_passed: bool
    
    fecha: Optional[datetime] = None

    class Config:
        from_attributes = True
