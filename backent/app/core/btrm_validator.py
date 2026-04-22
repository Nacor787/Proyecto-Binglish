"""
Módulo centralizado de validación para códigos de usuario.
Formatos válidos:
  - BTRM-### (estudiantes, ej: BTRM-204)
  - ADM-###  (administradores, ej: ADM-1)
  - TCH-###  (docentes, ej: TCH-100)
"""

import re
from fastapi import HTTPException, status

# Prefijos válidos por rol
VALID_PREFIXES = ("BTRM", "ADM", "TCH")

# Patrón regex: prefijo válido seguido de guión y uno o más dígitos
CODE_PATTERN = re.compile(r"^(BTRM|ADM|TCH)-(\d+)$")


def validate_btrm_code(code: str) -> str:
    """
    Valida que el código tenga el formato PREFIJO-### (BTRM-204, ADM-1, TCH-100).
    Retorna el código limpio (mayúsculas) o lanza HTTPException 400.
    """
    if not code or not isinstance(code, str):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El código de usuario es obligatorio.",
        )

    clean = code.strip().upper()

    if not CODE_PATTERN.match(clean):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Formato de código inválido: '{code}'. "
                "Use el formato PREFIJO-### (ejemplos: BTRM-204, ADM-1, TCH-100)."
            ),
        )
    return clean


def extract_number(code: str) -> int:
    """Extrae la parte numérica de un código válido."""
    clean = validate_btrm_code(code)
    match = CODE_PATTERN.match(clean)
    if not match:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Código de usuario inválido.",
        )
    return int(match.group(2))


def extract_prefix(code: str) -> str:
    """Extrae el prefijo (BTRM, ADM, TCH) de un código válido."""
    clean = validate_btrm_code(code)
    match = CODE_PATTERN.match(clean)
    if not match:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Código de usuario inválido.",
        )
    return match.group(1)


def build_code(prefix: str, number: int) -> str:
    """Construye un código a partir de un prefijo y un número entero."""
    prefix = prefix.upper()
    if prefix not in VALID_PREFIXES:
        raise ValueError(f"Prefijo inválido: {prefix}. Use uno de: {', '.join(VALID_PREFIXES)}")
    if number < 0:
        raise ValueError("El número debe ser positivo.")
    return f"{prefix}-{number}"


# Alias de retrocompatibilidad
def build_btrm_code(number: int) -> str:
    """Construye un código BTRM a partir de un número entero."""
    return build_code("BTRM", number)
