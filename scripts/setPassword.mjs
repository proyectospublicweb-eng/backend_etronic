// Uso: node scripts/setPassword.mjs <correoRegistro> <nuevaPassword>
import "dotenv/config";
import pg from "pg";
import bcrypt from "bcryptjs";

const [correoRegistro, nuevaPassword] = process.argv.slice(2);

if (!correoRegistro || !nuevaPassword) {
  console.error(
    "Uso: node scripts/setPassword.mjs <correoRegistro> <nuevaPassword>"
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
  const passwordCrypted = await bcrypt.hash(nuevaPassword, 10);

  const result = await pool.query(
    "UPDATE usuarios SET password=$1, token_version = token_version + 1 WHERE correoRegistro=$2 RETURNING idUsuario, correoRegistro",
    [passwordCrypted, correoRegistro]
  );

  if (result.rows.length === 0) {
    console.error(`No existe un usuario con correo ${correoRegistro}`);
    process.exit(1);
  }

  console.log("Contraseña actualizada:", result.rows[0]);
} catch (error) {
  console.error("Error:", error.message);
  process.exit(1);
} finally {
  await pool.end();
}
