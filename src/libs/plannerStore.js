import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "../db.js";
import { isDbUnavailableError } from "./adminBootstrap.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FALLBACK_DIR = path.resolve(__dirname, "../../data");
const FALLBACK_FILE = path.join(FALLBACK_DIR, "planner-store.dat");

let fallbackCache = null;

async function loadFallbackStore() {
  if (fallbackCache) return fallbackCache;
  try {
    const raw = await fs.readFile(FALLBACK_FILE, "utf8");
    const parsed = JSON.parse(raw);
    fallbackCache = {
      nextId: Number(parsed.nextId) || 1,
      submissions: Array.isArray(parsed.submissions) ? parsed.submissions : [],
    };
  } catch {
    fallbackCache = {
      nextId: 1,
      submissions: [],
    };
  }
  return fallbackCache;
}

async function persistFallbackStore(store) {
  await fs.mkdir(FALLBACK_DIR, { recursive: true });
  await fs.writeFile(FALLBACK_FILE, JSON.stringify(store, null, 2), "utf8");
}

function mapPgRow(row) {
  return {
    id: row.idregistro,
    nombre: row.nombre,
    telefono_whatsapp: row.telefono_whatsapp,
    total_seleccionadas: Number(row.total_seleccionadas) || 0,
    resumen_servicios: Array.isArray(row.resumen_servicios) ? row.resumen_servicios : [],
    comentarios: row.comentarios || "",
    estado: row.estado || "pendiente",
    notas_seguimiento: row.notas_seguimiento || "",
    creado_en: row.creado_en,
    actualizado_en: row.actualizado_en,
  };
}

function summarizeSubmissions(submissions) {
  return submissions.reduce(
    (acc, item) => {
      acc.total += 1;
      if (item.estado === "pendiente") acc.pendientes += 1;
      else if (item.estado === "en_seguimiento") acc.en_seguimiento += 1;
      else if (item.estado === "atendido") acc.atendidos += 1;
      return acc;
    },
    { total: 0, pendientes: 0, en_seguimiento: 0, atendidos: 0 }
  );
}

/**
 * Registers a client's selected project planner catalog alongside Name and WhatsApp.
 */
export async function createPlannerSubmission({
  nombre,
  telefonoWhatsapp,
  totalSeleccionadas,
  resumenServicios,
  comentarios = "",
}) {
  const cleanName = String(nombre || "").trim();
  const cleanPhone = String(telefonoWhatsapp || "").trim();
  const cleanComments = String(comentarios || "").trim();

  try {
    const inserted = await pool.query(
      `INSERT INTO planificador_registros (
         nombre,
         telefono_whatsapp,
         total_seleccionadas,
         resumen_servicios,
         comentarios,
         estado
       )
       VALUES ($1, $2, $3, $4::jsonb, $5, 'pendiente')
       RETURNING *`,
      [
        cleanName,
        cleanPhone,
        Number(totalSeleccionadas) || 0,
        JSON.stringify(resumenServicios || []),
        cleanComments,
      ]
    );
    return mapPgRow(inserted.rows[0]);
  } catch (err) {
    if (!isDbUnavailableError(err)) throw err;

    const store = await loadFallbackStore();
    const nowIso = new Date().toISOString();
    const record = {
      id: store.nextId++,
      nombre: cleanName,
      telefono_whatsapp: cleanPhone,
      total_seleccionadas: Number(totalSeleccionadas) || 0,
      resumen_servicios: Array.isArray(resumenServicios) ? resumenServicios : [],
      comentarios: cleanComments,
      estado: "pendiente",
      notas_seguimiento: "",
      creado_en: nowIso,
      actualizado_en: nowIso,
    };
    store.submissions.push(record);
    await persistFallbackStore(store);
    return record;
  }
}

/**
 * Lists all project planner submissions ordered newest-first for AdminDashboardPage.
 */
export async function listPlannerSubmissionsAdmin() {
  try {
    const res = await pool.query(
      `SELECT *
       FROM planificador_registros
       ORDER BY actualizado_en DESC, idregistro DESC`
    );
    const submissions = res.rows.map(mapPgRow);
    return {
      summary: summarizeSubmissions(submissions),
      submissions,
    };
  } catch (err) {
    if (!isDbUnavailableError(err)) throw err;

    const store = await loadFallbackStore();
    const sorted = [...store.submissions].sort(
      (a, b) => new Date(b.actualizado_en) - new Date(a.actualizado_en)
    );
    return {
      summary: summarizeSubmissions(sorted),
      submissions: sorted,
    };
  }
}

/**
 * Updates follow-up status or internal admin notes on a planner submission.
 */
export async function updatePlannerSubmissionAdmin(id, { estado, notas_seguimiento }) {
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) return null;

  try {
    const sets = [];
    const values = [];
    let paramIndex = 1;

    if (estado !== undefined) {
      sets.push(`estado = $${paramIndex++}`);
      values.push(estado);
    }
    if (notas_seguimiento !== undefined) {
      sets.push(`notas_seguimiento = $${paramIndex++}`);
      values.push(String(notas_seguimiento));
    }
    sets.push("actualizado_en = now()");
    values.push(numericId);

    const updated = await pool.query(
      `UPDATE planificador_registros
       SET ${sets.join(", ")}
       WHERE idregistro = $${paramIndex}
       RETURNING *`,
      values
    );
    if (updated.rowCount === 0) return null;
    return mapPgRow(updated.rows[0]);
  } catch (err) {
    if (!isDbUnavailableError(err)) throw err;

    const store = await loadFallbackStore();
    const record = store.submissions.find((item) => item.id === numericId);
    if (!record) return null;

    if (estado !== undefined) record.estado = estado;
    if (notas_seguimiento !== undefined) record.notas_seguimiento = String(notas_seguimiento);
    record.actualizado_en = new Date().toISOString();

    await persistFallbackStore(store);
    return record;
  }
}

/**
 * Deletes a planner submission record by ID.
 */
export async function deletePlannerSubmissionAdmin(id) {
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) return false;

  try {
    const res = await pool.query(
      "DELETE FROM planificador_registros WHERE idregistro = $1",
      [numericId]
    );
    return res.rowCount > 0;
  } catch (err) {
    if (!isDbUnavailableError(err)) throw err;

    const store = await loadFallbackStore();
    const before = store.submissions.length;
    store.submissions = store.submissions.filter((item) => item.id !== numericId);
    if (store.submissions.length === before) return false;

    await persistFallbackStore(store);
    return true;
  }
}
