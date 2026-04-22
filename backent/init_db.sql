-- =====================================================
-- Binglish - Script de inicialización de base de datos
-- =====================================================

-- Crear la base de datos (ejecutar por separado si es necesario)
-- CREATE DATABASE binglish_db;

-- Tipos enum
CREATE TYPE rol_enum AS ENUM ('admin', 'docente', 'estudiante');

-- Tabla de usuarios
CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(50) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE,
    hashed_password VARCHAR(255) NOT NULL,
    rol rol_enum NOT NULL DEFAULT 'estudiante',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de cursos
CREATE TABLE IF NOT EXISTS cursos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    descripcion TEXT,
    docente_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Tabla puente estudiantes-cursos (muchos a muchos)
CREATE TABLE IF NOT EXISTS estudiantes_cursos (
    id SERIAL PRIMARY KEY,
    estudiante_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    curso_id INTEGER NOT NULL REFERENCES cursos(id) ON DELETE CASCADE,
    fecha_inscripcion TIMESTAMP DEFAULT NOW()
);

-- Tabla de notas
CREATE TABLE IF NOT EXISTS notas (
    id SERIAL PRIMARY KEY,
    estudiante_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    curso_id INTEGER NOT NULL REFERENCES cursos(id) ON DELETE CASCADE,
    nota FLOAT NOT NULL,
    descripcion VARCHAR(255),
    fecha TIMESTAMP DEFAULT NOW()
);

-- Tabla de mensajes / avisos
CREATE TABLE IF NOT EXISTS mensajes (
    id SERIAL PRIMARY KEY,
    titulo VARCHAR(200) NOT NULL,
    contenido TEXT NOT NULL,
    autor_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    destinatario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_usuarios_codigo ON usuarios(codigo);
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);
CREATE INDEX IF NOT EXISTS idx_notas_estudiante ON notas(estudiante_id);
CREATE INDEX IF NOT EXISTS idx_notas_curso ON notas(curso_id);
CREATE INDEX IF NOT EXISTS idx_mensajes_destinatario ON mensajes(destinatario_id);

-- Usuario administrador por defecto
-- Código: BTRM-001 | Contraseña: admin123 (hash bcrypt)
INSERT INTO usuarios (codigo, nombre, apellido, email, hashed_password, rol)
VALUES (
    '001',
    'Admin',
    'Binglish',
    'admin@binglish.com',
    '$2b$12$LJ3m4ys3GZxkMrgi.hGNcOGG0j6XZKKPB6aO0KV7BLZE3kNxr0Ai',
    'admin'
) ON CONFLICT (codigo) DO NOTHING;

-- =====================================================
-- SCRIPT DE MIGRACIÓN (si ya tienes la BD creada y
-- necesitas agregar la columna 'codigo'):
-- =====================================================
-- ALTER TABLE usuarios ADD COLUMN codigo VARCHAR(50) UNIQUE;
-- CREATE INDEX IF NOT EXISTS idx_usuarios_codigo ON usuarios(codigo);
-- UPDATE usuarios SET codigo = 'ADMIN001' WHERE email = 'admin@binglish.com';
-- ALTER TABLE usuarios ALTER COLUMN codigo SET NOT NULL;
-- ALTER TABLE usuarios ALTER COLUMN email DROP NOT NULL;
