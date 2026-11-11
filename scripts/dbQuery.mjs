// Consulta la BD desde la terminal.
// Uso:
//   node scripts/dbQuery.mjs                              -> lista tablas y cantidad de filas
//   node scripts/dbQuery.mjs "SELECT * FROM usuarios"     -> ejecuta un SQL y muestra el resultado
import "dotenv/config";
import pg from "pg";

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

const sql = process.argv.slice(2).join(" ").trim();

const listTables = `
  SELECT
    table_name AS tabla,
    (xpath('/row/cnt/text()',
      query_to_xml(format('SELECT count(*) AS cnt FROM %I.%I', table_schema, table_name),
        false, true, '')))[1]::text::int AS filas
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  ORDER BY table_name;
`;

try {
  const result = sql
    ? await pool.query(sql)
    : await pool.query(listTables);
  console.table(result.rows);
  console.log(`\n${result.rowCount} fila(s).`);
} catch (err) {
  console.error("Error:", err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
