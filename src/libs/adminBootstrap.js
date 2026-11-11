import bcrypt from "bcryptjs";
import pg from "pg";
import { ADMIN_EMAIL, ADMIN_PASSWORD } from "../config.js";
import { pool } from "../db.js";

const { Client } = pg;

const PG_UNAVAILABLE_CODES = new Set([
  "28P01", // password authentication failed
  "28000", // invalid authorization specification
  "3D000", // database does not exist
  "42P01", // undefined_table
  "57P03", // cannot_connect_now
  "ECONNREFUSED",
  "ENOTFOUND",
  "ETIMEDOUT",
]);

export function isDbUnavailableError(error) {
  if (!error) return false;
  if (error.code && PG_UNAVAILABLE_CODES.has(error.code)) return true;
  const msg = String(error.message || "");
  return (
    msg.includes("ECONNREFUSED") ||
    msg.includes("autentificación password falló") ||
    msg.includes("password authentication failed") ||
    msg.includes("does not exist") ||
    msg.includes("no existe la base de datos")
  );
}

// Almacén de respaldo en memoria (con hash bcrypt real) activo únicamente
// mientras las credenciales locales de PostgreSQL en .env no estén conectadas.
const fallbackUsers = new Map();
let nextFallbackId = 2;

const masterHashPromise =
  ADMIN_PASSWORD.length >= 6
    ? bcrypt.hash(ADMIN_PASSWORD, 10).then((hash) => {
        fallbackUsers.set(1, {
          idusuario: 1,
          correoregistro: ADMIN_EMAIL,
          password: hash,
          rol: "admin",
          token_version: 0,
          creado_en: new Date().toISOString(),
        });
        return hash;
      })
    : Promise.resolve(null);

export async function getFallbackUserByEmail(email) {
  await masterHashPromise;
  const normalized = String(email || "").trim().toLowerCase();
  for (const user of fallbackUsers.values()) {
    if (user.correoregistro.toLowerCase() === normalized) {
      return user;
    }
  }
  return null;
}

export async function getFallbackUserById(id) {
  await masterHashPromise;
  return fallbackUsers.get(Number(id)) || null;
}

export async function listFallbackUsers() {
  await masterHashPromise;
  return Array.from(fallbackUsers.values()).map((u) => ({
    id: u.idusuario,
    correo: u.correoregistro,
    rol: u.rol,
    creado_en: u.creado_en,
  }));
}

export async function createFallbackUser({ correoRegistro, password, rol }) {
  await masterHashPromise;
  const existing = await getFallbackUserByEmail(correoRegistro);
  if (existing) {
    const err = new Error("Ya existe un usuario registrado con ese correo");
    err.statusCode = 409;
    throw err;
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const id = nextFallbackId++;
  const record = {
    idusuario: id,
    correoregistro: correoRegistro.trim().toLowerCase(),
    password: passwordHash,
    rol: rol || "usuario",
    token_version: 0,
    creado_en: new Date().toISOString(),
  };
  fallbackUsers.set(id, record);
  return {
    id: record.idusuario,
    correo: record.correoregistro,
    rol: record.rol,
    creado_en: record.creado_en,
  };
}

export async function updateFallbackUserRole(id, rol) {
  await masterHashPromise;
  const record = fallbackUsers.get(Number(id));
  if (!record) return null;
  record.rol = rol;
  return {
    id: record.idusuario,
    correo: record.correoregistro,
    rol: record.rol,
    creado_en: record.creado_en,
  };
}

export async function deleteFallbackUser(id) {
  await masterHashPromise;
  return fallbackUsers.delete(Number(id));
}

export async function ensureDatabaseAndAdmin() {
  const passwordHash = await masterHashPromise;

  // 1. Si usa variables locales sueltas, intenta crear etronic_bd si no existe
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
        console.log(`Base de datos ${dbName} creada automáticamente.`);
      }
    } catch {
      // Si falla la conexión inicial a postgres, el bloque siguiente informará el estado
    } finally {
      await adminClient.end().catch(() => {});
    }
  }

  // 2. Asegura esquema y cuenta administradora principal en PostgreSQL
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        idusuario       SERIAL PRIMARY KEY,
        correoregistro  VARCHAR(255) NOT NULL UNIQUE,
        password        VARCHAR(255) NOT NULL,
        rol             VARCHAR(30)  NOT NULL DEFAULT 'usuario',
        token_version   INTEGER NOT NULL DEFAULT 0,
        creado_en       TIMESTAMP NOT NULL DEFAULT now()
      );
      ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS rol VARCHAR(30) NOT NULL DEFAULT 'usuario';

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
    `);

    if (passwordHash) {
      await pool.query(
        `INSERT INTO usuarios (correoregistro, password, rol)
         VALUES ($1, $2, 'admin')
         ON CONFLICT (correoregistro)
         DO UPDATE SET password = EXCLUDED.password, rol = 'admin'`,
        [ADMIN_EMAIL, passwordHash]
      );

      console.log(
        `Administrador Etronic sincronizado en PostgreSQL: ${ADMIN_EMAIL}`
      );
    } else {
      console.warn(
        "Aviso: Define ADMIN_PASSWORD en .env para habilitar el administrador inicial."
      );
    }
  } catch (err) {
    if (isDbUnavailableError(err)) {
      console.warn(
        `Aviso PostgreSQL (${err.message}). Administrador "${ADMIN_EMAIL}" habilitado y listo para acceso inmediato.`
      );
    } else {
      console.error("Error al inicializar administrador:", err.message);
    }
  }
}
