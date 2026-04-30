"""
backup_service.py — Lógica de generación y restauración de backups PostgreSQL.
Usa subprocess para ejecutar pg_dump y psql de forma segura.
"""

import os
import shutil
import subprocess
from datetime import datetime
from urllib.parse import urlparse

from app.core.config import settings

# ── Carpeta de backups (fuera de backent/, en TRM/backups/) ──
BACKUP_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))), "backups")

# ── Rutas comunes de PostgreSQL en Windows ──
_PG_SEARCH_DIRS = [
    r"C:\Program Files\PostgreSQL",
    r"C:\Program Files (x86)\PostgreSQL",
]


def _find_pg_tool(tool_name: str) -> str:
    """
    Busca pg_dump o psql en el PATH del sistema y en las rutas
    estándar de instalación de PostgreSQL en Windows.
    Retorna la ruta completa al ejecutable o el nombre simple si está en PATH.
    """
    # 1. Intentar encontrarlo directamente en el PATH
    found = shutil.which(tool_name)
    if found:
        return found

    # 2. Buscar en las carpetas estándar de PostgreSQL (versiones 10-20)
    for base in _PG_SEARCH_DIRS:
        if not os.path.isdir(base):
            continue
        # Recorrer versiones de mayor a menor para usar la más reciente
        versions = sorted(os.listdir(base), reverse=True)
        for ver in versions:
            candidate = os.path.join(base, ver, "bin", f"{tool_name}.exe")
            if os.path.isfile(candidate):
                return candidate

    # 3. No encontrado
    raise FileNotFoundError(
        f"{tool_name} no encontrado. Verificar que PostgreSQL esté instalado "
        f"y que su carpeta bin esté en el PATH del sistema "
        f"(ej: C:\\Program Files\\PostgreSQL\\17\\bin)."
    )


def _parse_db_url():
    """Extrae host, port, user, password y dbname de DATABASE_URL."""
    parsed = urlparse(settings.DATABASE_URL)
    return {
        "host": parsed.hostname or "localhost",
        "port": str(parsed.port or 5432),
        "user": parsed.username or "postgres",
        "password": parsed.password or "",
        "dbname": parsed.path.lstrip("/"),
    }


def create_backup(table_name: str | None = None) -> dict:
    """
    Genera un archivo .sql usando pg_dump.
    Si table_name es proporcionado, hace backup solo de esa tabla.
    Retorna dict con status, filename y path.
    """
    os.makedirs(BACKUP_DIR, exist_ok=True)

    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M")
    suffix = f"_{table_name}" if table_name else "_full"
    filename = f"backup{suffix}_{timestamp}.sql"
    filepath = os.path.join(BACKUP_DIR, filename)

    db = _parse_db_url()

    # Construir comando pg_dump
    pg_dump_path = _find_pg_tool("pg_dump")
    cmd = [
        pg_dump_path,
        "-h", db["host"],
        "-p", db["port"],
        "-U", db["user"],
        "-d", db["dbname"],
        "-f", filepath,
        "--clean",
        "--if-exists",
        "--no-owner",
        "--no-privileges",
    ]

    if table_name:
        cmd.extend(["-t", table_name])

    env = os.environ.copy()
    env["PGPASSWORD"] = db["password"]

    try:
        result = subprocess.run(
            cmd, capture_output=True, text=True, timeout=120, env=env
        )
        if result.returncode != 0:
            raise RuntimeError(result.stderr.strip() or "pg_dump falló sin mensaje de error")

        file_size = os.path.getsize(filepath)
        return {
            "status": "success",
            "filename": filename,
            "path": filepath,
            "size_kb": round(file_size / 1024, 2),
            "timestamp": timestamp,
        }
    except FileNotFoundError:
        raise RuntimeError(
            "pg_dump no encontrado. Asegúrate de que PostgreSQL esté instalado "
            "y pg_dump esté en el PATH del sistema."
        )
    except subprocess.TimeoutExpired:
        raise RuntimeError("El proceso de backup excedió el tiempo límite (120s).")


def restore_backup(filepath: str) -> dict:
    """
    Restaura la base de datos desde un archivo .sql usando psql.
    Valida que el archivo no contenga comandos peligrosos.
    """
    # ── Validación básica del contenido ──
    _validate_sql_file(filepath)

    db = _parse_db_url()

    psql_path = _find_pg_tool("psql")
    cmd = [
        psql_path,
        "-h", db["host"],
        "-p", db["port"],
        "-U", db["user"],
        "-d", db["dbname"],
        "-f", filepath,
    ]

    env = os.environ.copy()
    env["PGPASSWORD"] = db["password"]

    try:
        result = subprocess.run(
            cmd, capture_output=True, text=True, timeout=300, env=env
        )
        if result.returncode != 0:
            # psql puede retornar errores parciales; revisamos stderr
            error_lines = [
                l for l in (result.stderr or "").splitlines()
                if "ERROR" in l.upper()
            ]
            if error_lines:
                raise RuntimeError("\n".join(error_lines[:5]))

        return {
            "status": "success",
            "message": "Base de datos restaurada correctamente.",
            "details": result.stdout[:500] if result.stdout else "",
        }
    except FileNotFoundError:
        raise RuntimeError(
            "psql no encontrado. Asegúrate de que PostgreSQL esté instalado "
            "y psql esté en el PATH del sistema."
        )
    except subprocess.TimeoutExpired:
        raise RuntimeError("El proceso de restauración excedió el tiempo límite (300s).")


def list_backups() -> list:
    """Lista todos los archivos .sql de la carpeta de backups."""
    os.makedirs(BACKUP_DIR, exist_ok=True)
    files = []
    for f in sorted(os.listdir(BACKUP_DIR), reverse=True):
        if f.endswith(".sql"):
            full = os.path.join(BACKUP_DIR, f)
            files.append({
                "filename": f,
                "size_kb": round(os.path.getsize(full) / 1024, 2),
                "created": datetime.fromtimestamp(os.path.getmtime(full)).isoformat(),
            })
    return files


def delete_backup(filename: str):
    """Elimina un archivo de backup existente."""
    safe_name = os.path.basename(filename)
    filepath = os.path.join(BACKUP_DIR, safe_name)

    if not os.path.exists(filepath):
        raise FileNotFoundError("Archivo no encontrado")

    os.remove(filepath)


def _validate_sql_file(filepath: str):
    """
    Validación básica de seguridad del archivo .sql.
    Rechaza archivos con comandos potencialmente peligrosos.
    """
    dangerous_patterns = [
        "COPY TO PROGRAM",
        "CREATE EXTENSION",
        "pg_execute_server_program",
        "lo_import",
        "lo_export",
    ]

    try:
        with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
            # Leer solo los primeros 50KB para no bloquear con archivos enormes
            content = f.read(50_000).upper()
            for pattern in dangerous_patterns:
                if pattern.upper() in content:
                    raise ValueError(
                        f"El archivo .sql contiene comandos no permitidos: {pattern}"
                    )
    except UnicodeDecodeError:
        raise ValueError("El archivo no es un archivo SQL válido (encoding incorrecto).")

def setup_scheduler_task(frequency: str, day: int, time_str: str) -> dict:
    """
    Configura una regla en el Programador de Tareas de Windows (schtasks).
    """
    import subprocess
    import sys

    task_name = "Binglish_Auto_Backup"
    
    # 1. Intentar borrar tarea anterior (ignorar error si no existe)
    subprocess.run(["schtasks", "/Delete", "/TN", task_name, "/F"], capture_output=True)

    if frequency == "none" or frequency == "":
        import json
        config_file = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "scheduler_config.json")
        try:
            with open(config_file, "w") as f:
                json.dump({"frequency": "none", "day": 1, "time_str": "02:00"}, f)
        except Exception:
            pass
        return {"status": "success", "message": "Automatización desactivada exitosamente."}

    script_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "scripts", "auto_backup.py")
    python_exec = sys.executable

    # Crear un archivo .bat para evitar los bugs de comillas de schtasks y el problema del directorio
    bat_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "scripts", "run_backup.bat")
    backend_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    try:
        with open(bat_path, "w") as f:
            f.write(f'@echo off\ncd /d "{backend_root}"\n"{python_exec}" "{script_path}"\n')
    except Exception as e:
        raise RuntimeError(f"Error al crear el ejecutable de backup: {e}")

    cmd = [
        "schtasks", "/Create", "/TN", task_name, 
        "/TR", bat_path, "/F"
    ]

    # Formatear la hora asegurando formato HH:MM
    try:
        hour, minute = time_str.split(":")
        time_formatted = f"{int(hour):02d}:{int(minute):02d}"
    except ValueError:
        time_formatted = "02:00"

    if frequency == "daily":
        cmd.extend(["/SC", "DAILY", "/ST", time_formatted])
    elif frequency == "weekly":
        # Mapeo de día de la semana para schtasks (MON, TUE, WED, THU, FRI, SAT, SUN)
        # JavaScript suele enviar: 0=Dom, 1=Lun, 2=Mar, 3=Mie, 4=Jue, 5=Vie, 6=Sab
        days_map = {0: "SUN", 1: "MON", 2: "TUE", 3: "WED", 4: "THU", 5: "FRI", 6: "SAT"}
        win_day = days_map.get(int(day), "MON")
        cmd.extend(["/SC", "WEEKLY", "/D", win_day, "/ST", time_formatted])
    elif frequency == "monthly":
        mes_dia = int(day) if int(day) > 0 and int(day) <= 31 else 1
        cmd.extend(["/SC", "MONTHLY", "/D", str(mes_dia), "/ST", time_formatted])

    try:
        res = subprocess.run(cmd, capture_output=True, text=True, check=True)
    except subprocess.CalledProcessError as e:
        raise RuntimeError(f"Error al configurar la tarea programada en Windows: {e.stderr or e.stdout}")
    except Exception as e:
        raise RuntimeError(f"No se pudo invocar schtasks: {str(e)}")

    # Guardar la configuración en un archivo para que el frontend pueda leerla
    import json
    config_file = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "scheduler_config.json")
    try:
        with open(config_file, "w") as f:
            json.dump({"frequency": frequency, "day": day, "time_str": time_formatted}, f)
    except Exception as e:
        print(f"No se pudo guardar scheduler_config.json: {e}")

    return {"status": "success", "message": "Tarea programada configurada exitosamente."}

def get_scheduler_status() -> dict:
    import json
    config_file = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "scheduler_config.json")
    if os.path.exists(config_file):
        try:
            with open(config_file, "r") as f:
                return json.load(f)
        except:
            pass
    return {"frequency": "none", "day": 1, "time_str": "02:00"}

