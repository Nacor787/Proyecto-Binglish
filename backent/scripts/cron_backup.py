#!/usr/bin/env python3
"""
cron_backup.py — Ejecutor de Backups Automáticos para Cron.
Este script se ejecuta aisaldamente sin despertar FastAPI. 
Permite al servidor Linux invocar la copia de seguridad.
"""

import sys
import os

# Asegurar que el directorio raíz 'backent' esté en el Python Path
# para poder hacer import "app.services..."
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_ROOT = os.path.dirname(CURRENT_DIR)
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from app.services.backup_service import create_backup

def main():
    try:
        # Generar el backup completo
        result = create_backup()
        print(f"[{result['timestamp']}] Backup completado con éxito.")
        print(f"Archivo: {result['filename']}")
        print(f"Tamaño: {result['size_kb']} KB")
    except Exception as e:
        print(f"Error al generar backup desde Cron: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
