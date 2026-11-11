// Conexión a BD PostgreSQL (credenciales desde variables de entorno)
import pg from "pg";

const { Pool } = pg;

const isProduction = process.env.NODE_ENV === "production";

function resolveSslConfig(hostOrUrl) {
  // Permite forzar o desactivar SSL explícitamente mediante DB_SSL=true|false
  if (typeof process.env.DB_SSL === "string" && process.env.DB_SSL.trim() !== "") {
    return process.env.DB_SSL.trim().toLowerCase() === "true"
      ? { rejectUnauthorized: false }
      : false;
  }

  // En cPanel, el servidor PostgreSQL interno (localhost / 127.0.0.1) no usa SSL
  const target = String(hostOrUrl || "localhost").trim();
  const isLocalHost = /(^localhost$|^127\.0\.0\.1$|@localhost[:/]|@127\.0\.0\.1[:/])/i.test(
    target
  );
  if (isLocalHost) {
    return false;
  }

  return isProduction || Boolean(process.env.DATABASE_URL)
    ? { rejectUnauthorized: false }
    : false;
}

export const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: resolveSslConfig(process.env.DATABASE_URL),
    })
  : new Pool({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT) || 5432,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: resolveSslConfig(process.env.DB_HOST),
    });
