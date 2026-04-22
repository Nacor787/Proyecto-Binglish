# Walkthrough — Módulo de Backup y Restauración de Base de Datos

## Resumen

Se implementó un módulo completo de backup y restauración de la base de datos PostgreSQL para la plataforma Binglish, con validación de contraseña de administrador, backups automáticos periódicos, y una interfaz frontend integrada en el dashboard.

---

## Archivos Creados / Modificados

### Backend

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| [backup_service.py](file:///c:/Users/PRO/Documents/TRM/backent/app/services/backup_service.py) | **NEW** | Lógica core: `pg_dump`, `psql`, validación SQL, listado de backups |
| [backups.py](file:///c:/Users/PRO/Documents/TRM/backent/app/routers/backups.py) | **NEW** | Endpoints: `GET /`, `POST /generate`, `POST /restore`, `GET /download/{file}` |
| [config.py](file:///c:/Users/PRO/Documents/TRM/backent/app/core/config.py) | MODIFY | Añadido `BACKUP_PASSWORD` y `BACKUP_INTERVAL` |
| [main.py](file:///c:/Users/PRO/Documents/TRM/backent/app/main.py) | MODIFY | Registrado router + APScheduler para backup automático |

### Frontend

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| [dashboard.js](file:///c:/Users/PRO/Documents/TRM/frontend/js/dashboard.js) | MODIFY | Añadido [renderBackups()](file:///c:/Users/PRO/Documents/TRM/frontend/js/dashboard.js#1192-1261), modal de contraseña, upload restore, historial |

---

## Endpoints API

| Método | Ruta | Descripción | Auth |
|--------|------|-------------|------|
| `GET` | `/backups/` | Lista backups disponibles | Token |
| `POST` | `/backups/generate` | Genera backup (JSON: password, table_name) | Token + Password |
| `POST` | `/backups/restore` | Restaura desde .sql (FormData: file, password) | Token + Password |
| `GET` | `/backups/download/{filename}` | Descarga un backup existente | — |

---

## Seguridad

- **Contraseña de admin** requerida para generar y restaurar backups (validada contra `BACKUP_PASSWORD` en [.env](file:///c:/Users/PRO/Documents/TRM/backent/.env))
- **Validación de archivo SQL**: Se rechazan archivos con comandos peligrosos (`COPY TO PROGRAM`, `CREATE EXTENSION`, etc.)
- **Prevención de path traversal**: Los nombres de archivo se sanitizan con `os.path.basename()`

## Backup Automático (APScheduler)

- Configurado en [main.py](file:///c:/Users/PRO/Documents/TRM/backent/app/main.py) usando `BackgroundScheduler`
- Frecuencia configurable: `BACKUP_INTERVAL` = `daily` | `weekly` (default) | `monthly`
- Ejecuta [create_backup()](file:///c:/Users/PRO/Documents/TRM/backent/app/services/backup_service.py#29-84) a las 2:00 AM automáticamente

## Verificación

- ✅ Router importado correctamente: `/backups`
- ✅ APScheduler instalado
- ⏳ Pruebas manuales pendientes (requieren `pg_dump`/`psql` en PATH del sistema)
