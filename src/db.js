// Conexión a BD PostgreSQL (credenciales desde variables de entorno)
import pg from "pg";

const { Pool } = pg;

const isProduction = process.env.NODE_ENV === "production";

export const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    })
  : new Pool({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT) || 5432,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: isProduction ? { rejectUnauthorized: false } : false,
    });
