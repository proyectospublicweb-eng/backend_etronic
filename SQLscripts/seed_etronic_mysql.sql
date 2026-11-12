-- =====================================================================
-- ETRONIC — Esquema e inyección de Administrador Principal (MySQL / MariaDB)
-- Uso: Importar o pegar en phpMyAdmin de cPanel sobre finlexprimecom_etronic
-- Cuenta: adminetronic27@gmail.com  |  Rol: admin
-- =====================================================================

CREATE TABLE IF NOT EXISTS usuarios (
  idusuario       INT AUTO_INCREMENT PRIMARY KEY,
  correoregistro  VARCHAR(255) NOT NULL UNIQUE,
  password        VARCHAR(255) NOT NULL,
  rol             VARCHAR(30)  NOT NULL DEFAULT 'usuario',
  token_version   INT          NOT NULL DEFAULT 0,
  creado_en       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS chat_conversaciones (
  idconversacion     INT AUTO_INCREMENT PRIMARY KEY,
  session_key        VARCHAR(80)  NOT NULL UNIQUE,
  nombre             VARCHAR(140) NOT NULL,
  contacto           VARCHAR(180) NOT NULL,
  estado             VARCHAR(30)  NOT NULL DEFAULT 'pendiente',
  notas_seguimiento  TEXT         NOT NULL,
  no_leidos_admin    INT          NOT NULL DEFAULT 0,
  creado_en          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS chat_mensajes (
  idmensaje          INT AUTO_INCREMENT PRIMARY KEY,
  idconversacion     INT          NOT NULL,
  remitente          VARCHAR(20)  NOT NULL DEFAULT 'cliente',
  mensaje            TEXT         NOT NULL,
  creado_en          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_chat_conversacion
    FOREIGN KEY (idconversacion) REFERENCES chat_conversaciones(idconversacion)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Inyección del Administrador Principal (contraseña encriptada con hash bcryptjs)
INSERT INTO usuarios (correoregistro, password, rol, token_version)
VALUES (
  'adminetronic27@gmail.com',
  '$2a$10$mlXTc90/0FEt2Hi2lmO7K.HLfrifjt6yZxK3JKlA7XXA/p9nNwzdq',
  'admin',
  0
)
ON DUPLICATE KEY UPDATE
  password = VALUES(password),
  rol = 'admin';
