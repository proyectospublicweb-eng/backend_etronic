-- =====================================================================
-- ETRONIC — Creación de Tablas + Inyección de Administrador (PostgreSQL)
-- Base de datos en cPanel: finlexprimecom_etronic (esquema: public)
-- Admin: adminetronic27@gmail.com  |  Rol: admin
-- =====================================================================

-- 1. Tabla de usuarios y administradores
CREATE TABLE IF NOT EXISTS public.usuarios (
  idusuario       SERIAL PRIMARY KEY,
  correoregistro  VARCHAR(255) NOT NULL UNIQUE,
  password        VARCHAR(255) NOT NULL,
  rol             VARCHAR(30)  NOT NULL DEFAULT 'usuario',
  token_version   INTEGER      NOT NULL DEFAULT 0,
  creado_en       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabla de conversaciones del chat de la Landing Page
CREATE TABLE IF NOT EXISTS public.chat_conversaciones (
  idconversacion     SERIAL PRIMARY KEY,
  session_key        VARCHAR(80)  NOT NULL UNIQUE,
  nombre             VARCHAR(140) NOT NULL,
  contacto           VARCHAR(180) NOT NULL,
  estado             VARCHAR(30)  NOT NULL DEFAULT 'pendiente',
  notas_seguimiento  TEXT         NOT NULL DEFAULT '',
  no_leidos_admin    INTEGER      NOT NULL DEFAULT 0,
  creado_en          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabla de mensajes individuales de cada conversación
CREATE TABLE IF NOT EXISTS public.chat_mensajes (
  idmensaje          SERIAL PRIMARY KEY,
  idconversacion     INTEGER      NOT NULL REFERENCES public.chat_conversaciones(idconversacion) ON DELETE CASCADE,
  remitente          VARCHAR(20)  NOT NULL DEFAULT 'cliente',
  mensaje            TEXT         NOT NULL,
  creado_en          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. Insertar cuenta administradora principal (contraseña encriptada con bcrypt)
INSERT INTO public.usuarios (correoregistro, password, rol, token_version)
VALUES (
  'adminetronic27@gmail.com',
  '$2a$10$mlXTc90/0FEt2Hi2lmO7K.HLfrifjt6yZxK3JKlA7XXA/p9nNwzdq',
  'admin',
  0
)
ON CONFLICT (correoregistro)
DO UPDATE SET
  password = EXCLUDED.password,
  rol = 'admin';

-- 5. Verificar que el administrador quedó registrado
SELECT idusuario, correoregistro, rol, creado_en FROM public.usuarios;
