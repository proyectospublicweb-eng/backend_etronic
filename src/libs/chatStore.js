import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "../db.js";
import { isDbUnavailableError } from "./adminBootstrap.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FALLBACK_DIR = path.resolve(__dirname, "../../data");
const FALLBACK_FILE = path.join(FALLBACK_DIR, "chat-store.dat");

export const AUTO_REPLY_MESSAGE =
  "En breve momento nos contactaremos con usted por su Correo o Tel-Whatsapp 😊";

let fallbackCache = null;

async function loadFallbackStore() {
  if (fallbackCache) return fallbackCache;
  try {
    const raw = await fs.readFile(FALLBACK_FILE, "utf8");
    const parsed = JSON.parse(raw);
    fallbackCache = {
      nextConvId: Number(parsed.nextConvId) || 1,
      nextMsgId: Number(parsed.nextMsgId) || 1,
      conversations: Array.isArray(parsed.conversations)
        ? parsed.conversations
        : [],
    };
  } catch {
    fallbackCache = {
      nextConvId: 1,
      nextMsgId: 1,
      conversations: [],
    };
  }
  return fallbackCache;
}

async function persistFallbackStore(store) {
  await fs.mkdir(FALLBACK_DIR, { recursive: true });
  await fs.writeFile(FALLBACK_FILE, JSON.stringify(store, null, 2), "utf8");
}

function mapPgRow(row, mensajes = []) {
  return {
    id: row.idconversacion,
    sessionKey: row.session_key,
    nombre: row.nombre,
    contacto: row.contacto,
    estado: row.estado,
    notas_seguimiento: row.notas_seguimiento || "",
    no_leidos_admin: Number(row.no_leidos_admin) || 0,
    creado_en: row.creado_en,
    actualizado_en: row.actualizado_en,
    mensajes,
  };
}

export async function addVisitorChatMessage({
  sessionKey,
  nombre,
  contacto,
  mensaje,
}) {
  const cleanSession = sessionKey.trim();
  const cleanName = nombre.trim();
  const cleanContact = contacto.trim();
  const cleanMessage = mensaje.trim();

  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");

    const upserted = await client.query(
      `INSERT INTO chat_conversaciones (session_key, nombre, contacto, estado, no_leidos_admin, actualizado_en)
       VALUES ($1, $2, $3, 'pendiente', 1, now())
       ON CONFLICT (session_key)
       DO UPDATE SET
         nombre = EXCLUDED.nombre,
         contacto = EXCLUDED.contacto,
         estado = CASE
           WHEN chat_conversaciones.estado = 'atendido' THEN 'pendiente'
           ELSE chat_conversaciones.estado
         END,
         no_leidos_admin = chat_conversaciones.no_leidos_admin + 1,
         actualizado_en = now()
       RETURNING *`,
      [cleanSession, cleanName, cleanContact]
    );

    const convRow = upserted.rows[0];

    await client.query(
      `INSERT INTO chat_mensajes (idconversacion, remitente, mensaje)
       VALUES ($1, 'cliente', $2)`,
      [convRow.idconversacion, cleanMessage]
    );

    await client.query(
      `INSERT INTO chat_mensajes (idconversacion, remitente, mensaje)
       VALUES ($1, 'sistema', $2)`,
      [convRow.idconversacion, AUTO_REPLY_MESSAGE]
    );

    const msgsRes = await client.query(
      `SELECT idmensaje AS id, remitente, mensaje, creado_en
       FROM chat_mensajes
       WHERE idconversacion = $1
       ORDER BY idmensaje ASC`,
      [convRow.idconversacion]
    );

    await client.query("COMMIT");
    return mapPgRow(convRow, msgsRes.rows);
  } catch (err) {
    await client?.query("ROLLBACK").catch(() => {});
    if (!isDbUnavailableError(err)) throw err;

    const store = await loadFallbackStore();
    const nowIso = new Date().toISOString();
    let conv = store.conversations.find((c) => c.sessionKey === cleanSession);

    if (!conv) {
      conv = {
        id: store.nextConvId++,
        sessionKey: cleanSession,
        nombre: cleanName,
        contacto: cleanContact,
        estado: "pendiente",
        notas_seguimiento: "",
        no_leidos_admin: 1,
        creado_en: nowIso,
        actualizado_en: nowIso,
        mensajes: [],
      };
      store.conversations.push(conv);
    } else {
      conv.nombre = cleanName;
      conv.contacto = cleanContact;
      if (conv.estado === "atendido") conv.estado = "pendiente";
      conv.no_leidos_admin = (conv.no_leidos_admin || 0) + 1;
      conv.actualizado_en = nowIso;
    }

    conv.mensajes.push({
      id: store.nextMsgId++,
      remitente: "cliente",
      mensaje: cleanMessage,
      creado_en: nowIso,
    });

    conv.mensajes.push({
      id: store.nextMsgId++,
      remitente: "sistema",
      mensaje: AUTO_REPLY_MESSAGE,
      creado_en: nowIso,
    });

    await persistFallbackStore(store);
    return conv;
  } finally {
    client?.release();
  }
}

export async function getConversationBySessionKey(sessionKey) {
  const cleanSession = String(sessionKey || "").trim();
  if (!cleanSession) return null;

  try {
    const convRes = await pool.query(
      `SELECT * FROM chat_conversaciones WHERE session_key = $1`,
      [cleanSession]
    );
    if (convRes.rows.length === 0) return null;

    const convRow = convRes.rows[0];
    const msgsRes = await pool.query(
      `SELECT idmensaje AS id, remitente, mensaje, creado_en
       FROM chat_mensajes
       WHERE idconversacion = $1
       ORDER BY idmensaje ASC`,
      [convRow.idconversacion]
    );
    return mapPgRow(convRow, msgsRes.rows);
  } catch (err) {
    if (!isDbUnavailableError(err)) throw err;
    const store = await loadFallbackStore();
    return (
      store.conversations.find((c) => c.sessionKey === cleanSession) || null
    );
  }
}

export async function listAllChatConversations() {
  try {
    const convsRes = await pool.query(
      `SELECT * FROM chat_conversaciones ORDER BY actualizado_en DESC`
    );
    const msgsRes = await pool.query(
      `SELECT idmensaje AS id, idconversacion, remitente, mensaje, creado_en
       FROM chat_mensajes
       ORDER BY idmensaje ASC`
    );

    const byConv = new Map();
    for (const msg of msgsRes.rows) {
      const list = byConv.get(msg.idconversacion) || [];
      list.push({
        id: msg.id,
        remitente: msg.remitente,
        mensaje: msg.mensaje,
        creado_en: msg.creado_en,
      });
      byConv.set(msg.idconversacion, list);
    }

    const conversations = convsRes.rows.map((row) =>
      mapPgRow(row, byConv.get(row.idconversacion) || [])
    );

    return buildAdminSummary(conversations);
  } catch (err) {
    if (!isDbUnavailableError(err)) throw err;
    const store = await loadFallbackStore();
    const sorted = [...store.conversations].sort(
      (a, b) => new Date(b.actualizado_en) - new Date(a.actualizado_en)
    );
    return buildAdminSummary(sorted);
  }
}

function buildAdminSummary(conversations) {
  let pendientes = 0;
  let en_seguimiento = 0;
  let atendidos = 0;
  let no_leidos = 0;

  for (const c of conversations) {
    if (c.estado === "pendiente") pendientes++;
    else if (c.estado === "en_seguimiento") en_seguimiento++;
    else if (c.estado === "atendido") atendidos++;
    no_leidos += Number(c.no_leidos_admin) || 0;
  }

  return {
    summary: {
      total: conversations.length,
      pendientes,
      en_seguimiento,
      atendidos,
      no_leidos,
    },
    conversations,
  };
}

export async function updateChatConversationByAdmin(
  id,
  { estado, notas_seguimiento, marcarLeido }
) {
  const targetId = Number(id);
  try {
    const current = await pool.query(
      `SELECT * FROM chat_conversaciones WHERE idconversacion = $1`,
      [targetId]
    );
    if (current.rows.length === 0) return null;

    const existing = current.rows[0];
    const nextEstado = estado ?? existing.estado;
    const nextNotas =
      notas_seguimiento !== undefined
        ? notas_seguimiento
        : existing.notas_seguimiento;
    const nextNoLeidos = marcarLeido ? 0 : existing.no_leidos_admin;

    const updated = await pool.query(
      `UPDATE chat_conversaciones
       SET estado = $1,
           notas_seguimiento = $2,
           no_leidos_admin = $3
       WHERE idconversacion = $4
       RETURNING *`,
      [nextEstado, nextNotas, nextNoLeidos, targetId]
    );

    const msgsRes = await pool.query(
      `SELECT idmensaje AS id, remitente, mensaje, creado_en
       FROM chat_mensajes
       WHERE idconversacion = $1
       ORDER BY idmensaje ASC`,
      [targetId]
    );

    return mapPgRow(updated.rows[0], msgsRes.rows);
  } catch (err) {
    if (!isDbUnavailableError(err)) throw err;
    const store = await loadFallbackStore();
    const conv = store.conversations.find((c) => c.id === targetId);
    if (!conv) return null;

    if (estado !== undefined) conv.estado = estado;
    if (notas_seguimiento !== undefined)
      conv.notas_seguimiento = notas_seguimiento;
    if (marcarLeido) conv.no_leidos_admin = 0;

    await persistFallbackStore(store);
    return conv;
  }
}

export async function addAdminChatReply(id, mensaje) {
  const targetId = Number(id);
  const cleanMsg = mensaje.trim();

  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");

    const updatedConv = await client.query(
      `UPDATE chat_conversaciones
       SET no_leidos_admin = 0,
           estado = CASE WHEN estado = 'pendiente' THEN 'en_seguimiento' ELSE estado END,
           actualizado_en = now()
       WHERE idconversacion = $1
       RETURNING *`,
      [targetId]
    );

    if (updatedConv.rows.length === 0) {
      await client.query("ROLLBACK");
      return null;
    }

    await client.query(
      `INSERT INTO chat_mensajes (idconversacion, remitente, mensaje)
       VALUES ($1, 'admin', $2)`,
      [targetId, cleanMsg]
    );

    const msgsRes = await client.query(
      `SELECT idmensaje AS id, remitente, mensaje, creado_en
       FROM chat_mensajes
       WHERE idconversacion = $1
       ORDER BY idmensaje ASC`,
      [targetId]
    );

    await client.query("COMMIT");
    return mapPgRow(updatedConv.rows[0], msgsRes.rows);
  } catch (err) {
    await client?.query("ROLLBACK").catch(() => {});
    if (!isDbUnavailableError(err)) throw err;

    const store = await loadFallbackStore();
    const conv = store.conversations.find((c) => c.id === targetId);
    if (!conv) return null;

    const nowIso = new Date().toISOString();
    conv.no_leidos_admin = 0;
    if (conv.estado === "pendiente") conv.estado = "en_seguimiento";
    conv.actualizado_en = nowIso;
    conv.mensajes.push({
      id: store.nextMsgId++,
      remitente: "admin",
      mensaje: cleanMsg,
      creado_en: nowIso,
    });

    await persistFallbackStore(store);
    return conv;
  } finally {
    client?.release();
  }
}

export async function deleteChatConversationByAdmin(id) {
  const targetId = Number(id);
  try {
    const deleted = await pool.query(
      `DELETE FROM chat_conversaciones WHERE idconversacion = $1 RETURNING idconversacion`,
      [targetId]
    );
    return deleted.rowCount > 0;
  } catch (err) {
    if (!isDbUnavailableError(err)) throw err;
    const store = await loadFallbackStore();
    const idx = store.conversations.findIndex((c) => c.id === targetId);
    if (idx === -1) return false;
    store.conversations.splice(idx, 1);
    await persistFallbackStore(store);
    return true;
  }
}
