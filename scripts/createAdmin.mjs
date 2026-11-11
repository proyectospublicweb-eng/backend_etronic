// Crea un usuario administrador o promueve a 'admin' uno existente.
// Uso: npm run create-admin [-- <correoRegistro> <password>]
// Si no se pasan argumentos, utiliza ADMIN_EMAIL y ADMIN_PASSWORD de .env.
import "dotenv/config";
import pg from "pg";
import bcrypt from "bcryptjs";

const [argEmail, argPassword] = process.argv.slice(2);
const correoRegistro =
  argEmail || process.env.ADMIN_EMAIL || "adminetronic27@gmail.com";
const password = argPassword || process.env.ADMIN_PASSWORD || "";

if (password.length < 6) {
  console.error(
    "Define ADMIN_PASSWORD en .env o pásala como argumento (mínimo 6 caracteres)."
  );
  process.exit(1);
}

const isProduction = process.env.NODE_ENV === "production";

const pool = process.env.DATABASE_URL
  ? new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    })
  : new pg.Pool({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT) || 5432,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: isProduction ? { rejectUnauthorized: false } : false,
    });

try {
  await pool.query(
    "ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS rol VARCHAR(30) NOT NULL DEFAULT 'usuario'"
  );

  const passwordCrypted = await bcrypt.hash(password, 10);

  const result = await pool.query(
    `INSERT INTO usuarios (correoregistro, password, rol)
     VALUES ($1, $2, 'admin')
     ON CONFLICT (correoregistro)
     DO UPDATE SET password = EXCLUDED.password, rol = 'admin', token_version = usuarios.token_version + 1
     RETURNING idusuario, correoregistro, rol`,
    [correoRegistro.trim().toLowerCase(), passwordCrypted]
  );

  console.log("Administrador configurado con éxito:", result.rows[0]);
} catch (error) {
  console.error("Error al configurar administrador:", error.message);
  process.exit(1);
} finally {
  await pool.end();
}
