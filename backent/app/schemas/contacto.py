from pydantic import BaseModel, EmailStr


class ContactoForm(BaseModel):
    nombre: str
    email: EmailStr
    asunto: str
    mensaje: str
