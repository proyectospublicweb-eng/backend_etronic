// Conexión a BD PostgreSQL (credenciales desde variables de entorno)
import pg from "pg";

const { Pool } = pg;

const isProduction = process.env.NODE_ENV === "production";

function normalizeHost(rawHost) {
  const cleaned = String(rawHost || "127.0.0.1").trim();
  // En cPanel, pg_hba.conf autoriza IPv4 (127.0.0.1) y puede rechazar IPv6 (::1) al resolver "localhost"
  if (/^(localhost|::1)$/i.test(cleaned)) {
    return "127.0.0.1";
  }
  return cleaned;
}

function resolveSslConfig(hostOrUrl) {
  // Permite forzar o desactivar SSL explícitamente mediante DB_SSL=true|false
  if (typeof process.env.DB_SSL === "string" && process.env.DB_SSL.trim() !== "") {
    return process.env.DB_SSL.trim().toLowerCase() === "true"
      ? { rejectUnauthorized: false }
      : false;
  }

  // En cPanel, el servidor PostgreSQL interno (localhost / 127.0.0.1) no usa SSL
  const target = String(hostOrUrl || "127.0.0.1").trim();
  const isLocalHost = /(^localhost$|^127\.0\.0\.1$|^::1$|@localhost[:/]|@127\.0\.0\.1[:/])/i.test(
    target
  );
  if (isLocalHost) {
    return false;
  }

  return isProduction || Boolean(process.env.DATABASE_URL)
    ? { rejectUnauthorized: false }
    : false;
}

const rawDbUrl = (process.env.DATABASE_URL || "").trim();
const dbHost = normalizeHost(process.env.DB_HOST);
const dbPort = Number(String(process.env.DB_PORT || "5432").trim()) || 5432;
const dbUser = (process.env.DB_USER || "").trim();
const dbPassword = (process.env.DB_PASSWORD || "").trim();
const dbName = (process.env.DB_NAME || "").trim();

export const pool = rawDbUrl
  ? new Pool({
      connectionString: rawDbUrl,
      ssl: resolveSslConfig(rawDbUrl),
    })
  : new Pool({
      host: dbHost,
      port: dbPort,
      user: dbUser,
      password: dbPassword,
      database: dbName,
      ssl: resolveSslConfig(dbHost),
    });
