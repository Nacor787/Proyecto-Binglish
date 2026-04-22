"""
Módulo de protección contra fuerza bruta (Rate Limiter).
Almacenamiento en memoria con diccionarios Python.

Reglas:
- Máximo 5 intentos fallidos antes de bloquear.
- Bloqueo progresivo: 1 min, 2 min, 3 min, etc.
- Se resetea tras un login exitoso.
"""

import time
from threading import Lock

# ---------- Configuración ----------

MAX_ATTEMPTS = 5
BASE_LOCKOUT_SECONDS = 60  # 1 minuto base

# ---------- Almacenamiento en memoria ----------
# Estructura: { "identificador": { "attempts": int, "lockout_count": int, "locked_until": float } }

_login_attempts: dict[str, dict] = {}
_lock = Lock()


def _get_record(identifier: str) -> dict:
    """Obtiene o crea el registro de intentos para un identificador."""
    if identifier not in _login_attempts:
        _login_attempts[identifier] = {
            "attempts": 0,
            "lockout_count": 0,
            "locked_until": 0.0,
        }
    return _login_attempts[identifier]


def check_rate_limit(identifier: str) -> dict | None:
    """
    Verifica si el identificador está bloqueado.

    Retorna None si puede intentar.
    Retorna dict con info de bloqueo si está bloqueado:
      {"locked": True, "retry_after": int (segundos restantes)}
    """
    with _lock:
        record = _get_record(identifier)
        now = time.time()

        if record["locked_until"] > now:
            retry_after = int(record["locked_until"] - now) + 1
            return {
                "locked": True,
                "retry_after": retry_after,
            }

        # Si el bloqueo ya expiró, resetear intentos para nuevo ciclo
        if record["locked_until"] > 0 and record["locked_until"] <= now:
            record["attempts"] = 0
            record["locked_until"] = 0.0

        return None


def register_failed_attempt(identifier: str) -> dict:
    """
    Registra un intento fallido.

    Retorna:
      {"attempts_remaining": int, "locked": bool, "retry_after": int | None}
    """
    with _lock:
        record = _get_record(identifier)
        record["attempts"] += 1

        attempts_remaining = MAX_ATTEMPTS - record["attempts"]

        if attempts_remaining <= 0:
            # Bloquear: incrementar contador de bloqueos y calcular duración
            record["lockout_count"] += 1
            lockout_duration = BASE_LOCKOUT_SECONDS * record["lockout_count"]
            record["locked_until"] = time.time() + lockout_duration

            return {
                "attempts_remaining": 0,
                "locked": True,
                "retry_after": lockout_duration,
                "lockout_number": record["lockout_count"],
            }

        return {
            "attempts_remaining": attempts_remaining,
            "locked": False,
            "retry_after": None,
        }


def register_successful_login(identifier: str) -> None:
    """Resetea los intentos tras un login exitoso."""
    with _lock:
        _login_attempts.pop(identifier, None)
