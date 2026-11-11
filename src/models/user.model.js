// Modelo de datos de la tabla "usuarios" (BD PostgreSQL)
// Nota: PostgreSQL convierte los identificadores sin comillas a minúsculas.
// Tabla esperada:
//   idusuario        SERIAL PRIMARY KEY
//   correoregistro   VARCHAR(255) NOT NULL UNIQUE
//   password         VARCHAR(255) NOT NULL
//   rol              VARCHAR(30)  NOT NULL DEFAULT 'usuario'  -- 'admin' | 'usuario'
//   token_version    INTEGER      NOT NULL DEFAULT 0
//   creado_en        TIMESTAMP    NOT NULL DEFAULT now()
