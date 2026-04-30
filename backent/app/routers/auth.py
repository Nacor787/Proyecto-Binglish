from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.core.security import (
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
)
from app.core.rate_limiter import (
    check_rate_limit,
    register_failed_attempt,
    register_successful_login,
)
from app.core.btrm_validator import validate_btrm_code
from app.schemas.user import LoginRequest, Token
from app.services.user_service import get_user_by_codigo

router = APIRouter(prefix="/auth", tags=["Autenticación"])


# ---------- Schemas ----------

class RefreshRequest(BaseModel):
    refresh_token: str


class TokenWithRefresh(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


# ---------- Login ----------

@router.post("/login", response_model=TokenWithRefresh)
def login(data: LoginRequest, request: Request, db: Session = Depends(get_db)):
    """
    Inicia sesión con código de usuario (BTRM-###, ADM-### o TCH-###) y contraseña.
    Protegido contra fuerza bruta (máx. 5 intentos, bloqueo progresivo).
    """
    # Validar formato BTRM-### (defensa en profundidad, el schema ya valida)
    codigo = validate_btrm_code(data.codigo)

    # Identificador: IP del cliente + código de usuario
    client_ip = request.client.host if request.client else "unknown"
    identifier = f"{client_ip}:{codigo}"

    # 1. Verificar si está bloqueado
    block_info = check_rate_limit(identifier)
    if block_info:
        minutes = block_info["retry_after"] // 60
        seconds = block_info["retry_after"] % 60

        if minutes > 0:
            time_msg = f"{minutes} min y {seconds} seg"
        else:
            time_msg = f"{seconds} segundos"

        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "message": f"Demasiados intentos fallidos. Intenta nuevamente en {time_msg}.",
                "retry_after": block_info["retry_after"],
                "locked": True,
            },
        )

    # 2. Validar credenciales
    user = get_user_by_codigo(db, codigo)
    if not user or not verify_password(data.password, str(user.hashed_password)):
        # Registrar intento fallido
        result = register_failed_attempt(identifier)

        if result["locked"]:
            minutes = result["retry_after"] // 60
            seconds = result["retry_after"] % 60
            if minutes > 0:
                time_msg = f"{minutes} min y {seconds} seg"
            else:
                time_msg = f"{seconds} segundos"

            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={
                    "message": f"Has agotado los 5 intentos. Cuenta bloqueada por {time_msg}.",
                    "retry_after": result["retry_after"],
                    "locked": True,
                    "attempts_remaining": 0,
                },
            )

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "message": f"Credenciales inválidas. Te quedan {result['attempts_remaining']} intento(s).",
                "attempts_remaining": result["attempts_remaining"],
                "locked": False,
            },
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 3. Login exitoso → resetear intentos
    register_successful_login(identifier)

    token_data = {"sub": str(user.id), "rol": user.rol.value}
    access_token = create_access_token(data=token_data)
    refresh_token = create_refresh_token(data=token_data)

    return TokenWithRefresh(
        access_token=access_token,
        refresh_token=refresh_token,
    )


# ---------- Refresh ----------

@router.post("/refresh", response_model=TokenWithRefresh)
def refresh_token(data: RefreshRequest, db: Session = Depends(get_db)):
    """
    Renueva el access token usando un refresh token válido.
    Retorna un nuevo par de access + refresh tokens.
    """
    payload = decode_refresh_token(data.refresh_token)

    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token inválido",
        )

    from app.db.models import User
    user = db.query(User).filter(User.id == int(user_id)).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no encontrado",
        )

    token_data = {"sub": str(user.id), "rol": user.rol.value}
    new_access_token = create_access_token(data=token_data)
    new_refresh_token = create_refresh_token(data=token_data)

    return TokenWithRefresh(
        access_token=new_access_token,
        refresh_token=new_refresh_token,
    )
