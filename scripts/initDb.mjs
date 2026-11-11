import "dotenv/config";
import pg from "pg";
import bcrypt from "bcryptjs";

const { Pool, Client } = pg;

if (!process.env.DATABASE_URL && !process.env.DB_USER) {
  console.error("Falta DATABASE_URL o DB_USER. Define las credenciales en .env.");
  process.exit(1);
}

// Si es conexión local por variables sueltas y la BD aún no existe, intentamos crearla
if (!process.env.DATABASE_URL && process.env.DB_NAME) {
  const dbName = process.env.DB_NAME;
  const adminClient = new Client({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: "postgres",
  });

  try {
    await adminClient.connect();
    const exists = await adminClient.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [dbName]
    );
    if (exists.rowCount === 0) {
      const safeIdent = `"${dbName.replace(/"/g, '""')}"`;
      await adminClient.query(`CREATE DATABASE ${safeIdent}`);
      console.log(`Base de datos ${dbName} creada correctamente.`);
    }
  } catch (err) {
    console.warn("Aviso al verificar/crear base de datos:", err.message);
  } finally {
    await adminClient.end().catch(() => {});
  }
}

const url =
  process.env.DATABASE_URL ||
  `postgres://${process.env.DB_USER}:${encodeURIComponent(
    process.env.DB_PASSWORD || ""
  )}@${process.env.DB_HOST}:${process.env.DB_PORT || 5432}/${
    process.env.DB_NAME
  }`;

const isLocal = /(localhost|127\.0\.0\.1)/.test(url);

const pool = new Pool({
  connectionString: url,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

const ddl = `
CREATE TABLE IF NOT EXISTS usuarios (
  idusuario       SERIAL PRIMARY KEY,
  correoregistro  VARCHAR(255) NOT NULL UNIQUE,
  password        VARCHAR(255) NOT NULL,
  rol             VARCHAR(30)  NOT NULL DEFAULT 'usuario',
  token_version   INTEGER NOT NULL DEFAULT 0,
  creado_en       TIMESTAMP NOT NULL DEFAULT now()
);

-- Columnas incrementales para bases de datos existentes
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS rol VARCHAR(30) NOT NULL DEFAULT 'usuario';

CREATE TABLE IF NOT EXISTS chat_conversaciones (
  idconversacion     SERIAL PRIMARY KEY,
  session_key        VARCHAR(80)  NOT NULL UNIQUE,
  nombre             VARCHAR(140) NOT NULL,
  contacto           VARCHAR(180) NOT NULL,
  estado             VARCHAR(30)  NOT NULL DEFAULT 'pendiente',
  notas_seguimiento  TEXT         NOT NULL DEFAULT '',
  no_leidos_admin    INTEGER      NOT NULL DEFAULT 0,
  creado_en          TIMESTAMP    NOT NULL DEFAULT now(),
  actualizado_en     TIMESTAMP    NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_mensajes (
  idmensaje          SERIAL PRIMARY KEY,
  idconversacion     INTEGER      NOT NULL REFERENCES chat_conversaciones(idconversacion) ON DELETE CASCADE,
  remitente          VARCHAR(20)  NOT NULL DEFAULT 'cliente',
  mensaje            TEXT         NOT NULL,
  creado_en          TIMESTAMP    NOT NULL DEFAULT now()
);
`;

const adminEmail = (
  process.env.ADMIN_EMAIL || "adminetronic27@gmail.com"
).trim().toLowerCase();
const adminPassword = process.env.ADMIN_PASSWORD || "";

try {
  await pool.query(ddl);
  console.log("Esquema creado/verificado correctamente.");

  if (adminPassword.length >= 6) {
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    await pool.query(
      `INSERT INTO usuarios (correoregistro, password, rol)
       VALUES ($1, $2, 'admin')
       ON CONFLICT (correoregistro)
       DO UPDATE SET password = EXCLUDED.password, rol = 'admin'`,
      [adminEmail, passwordHash]
    );
    console.log(`Administrador principal configurado: ${adminEmail}`);
  } else {
    console.warn(
      "Aviso: Define ADMIN_PASSWORD (mín. 6 caracteres) en .env para sincronizar el administrador principal."
    );
  }

  const { rows } = await pool.query(
    "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename"
  );
  console.log("Tablas en public:", rows.map((r) => r.tablename).join(", "));
} catch (err) {
  console.error("Error al crear el esquema:", err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
