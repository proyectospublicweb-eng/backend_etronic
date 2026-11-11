import bcrypt from "bcryptjs";
import { pool } from "../db.js";
import {
  isDbUnavailableError,
  listFallbackUsers,
  createFallbackUser,
  updateFallbackUserRole,
  deleteFallbackUser,
} from "../libs/adminBootstrap.js";

export const getDashboardStats = async (req, res) => {
  try {
    const countsResult = await pool.query(`
      SELECT
        COUNT(*)::int AS total_usuarios,
        COUNT(*) FILTER (WHERE rol = 'admin')::int AS total_admins,
        COUNT(*) FILTER (WHERE rol <> 'admin')::int AS total_estandar,
        COUNT(*) FILTER (WHERE creado_en >= now() - interval '7 days')::int AS nuevos_7_dias
      FROM usuarios
    `);

    const recentResult = await pool.query(`
      SELECT idusuario AS id, correoregistro AS correo, rol, creado_en
      FROM usuarios
      ORDER BY creado_en DESC
      LIMIT 5
    `);

    res.json({
      stats: countsResult.rows[0],
      recentUsers: recentResult.rows,
    });
  } catch (error) {
    if (isDbUnavailableError(error)) {
      const memUsers = await listFallbackUsers();
      const totalAdmins = memUsers.filter((u) => u.rol === "admin").length;
      return res.json({
        stats: {
          total_usuarios: memUsers.length,
          total_admins: totalAdmins,
          total_estandar: memUsers.length - totalAdmins,
          nuevos_7_dias: memUsers.length,
        },
        recentUsers: [...memUsers].reverse().slice(0, 5),
      });
    }
    res.status(500).json({ message: error.message });
  }
};

export const listUsers = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT idusuario AS id, correoregistro AS correo, rol, creado_en
      FROM usuarios
      ORDER BY idusuario ASC
    `);
    res.json(result.rows);
  } catch (error) {
    if (isDbUnavailableError(error)) {
      const memUsers = await listFallbackUsers();
      return res.json(memUsers);
    }
    res.status(500).json({ message: error.message });
  }
};

export const createUserByAdmin = async (req, res) => {
  const correo = req.body.correoRegistro.trim().toLowerCase();
  const { password, rol } = req.body;

  try {
    const exists = await pool.query(
      "SELECT idusuario FROM usuarios WHERE LOWER(correoregistro) = LOWER($1)",
      [correo]
    );

    if (exists.rows.length > 0) {
      return res
        .status(409)
        .json({ message: "Ya existe un usuario registrado con ese correo" });
    }

    const passwordCrypted = await bcrypt.hash(password, 10);
    const inserted = await pool.query(
      `INSERT INTO usuarios (correoregistro, password, rol)
       VALUES ($1, $2, $3)
       RETURNING idusuario AS id, correoregistro AS correo, rol, creado_en`,
      [correo, passwordCrypted, rol || "usuario"]
    );

    res.status(201).json(inserted.rows[0]);
  } catch (error) {
    if (isDbUnavailableError(error)) {
      try {
        const created = await createFallbackUser({
          correoRegistro: correo,
          password,
          rol,
        });
        return res.status(201).json(created);
      } catch (fallbackErr) {
        return res
          .status(fallbackErr.statusCode || 500)
          .json({ message: fallbackErr.message });
      }
    }
    res.status(500).json({ message: error.message });
  }
};

export const updateUserRole = async (req, res) => {
  const targetId = Number(req.params.id);
  const { rol } = req.body;

  if (!Number.isInteger(targetId) || targetId <= 0) {
    return res.status(400).json({ message: "ID de usuario no válido" });
  }

  if (req.user.id === targetId && rol !== "admin") {
    return res.status(400).json({
      message: "No puedes revocar tus propios permisos de administrador",
    });
  }

  try {
    const updated = await pool.query(
      `UPDATE usuarios
       SET rol = $1
       WHERE idusuario = $2
       RETURNING idusuario AS id, correoregistro AS correo, rol, creado_en`,
      [rol, targetId]
    );

    if (updated.rows.length === 0) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    res.json(updated.rows[0]);
  } catch (error) {
    if (isDbUnavailableError(error)) {
      const updated = await updateFallbackUserRole(targetId, rol);
      if (!updated) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }
      return res.json(updated);
    }
    res.status(500).json({ message: error.message });
  }
};

export const deleteUserByAdmin = async (req, res) => {
  const targetId = Number(req.params.id);

  if (!Number.isInteger(targetId) || targetId <= 0) {
    return res.status(400).json({ message: "ID de usuario no válido" });
  }

  if (req.user.id === targetId) {
    return res.status(400).json({
      message: "No puedes eliminar tu propia cuenta activa",
    });
  }

  try {
    const deleted = await pool.query(
      "DELETE FROM usuarios WHERE idusuario = $1 RETURNING idusuario AS id",
      [targetId]
    );

    if (deleted.rows.length === 0) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    res.json({ id: targetId, message: "Usuario eliminado correctamente" });
  } catch (error) {
    if (isDbUnavailableError(error)) {
      const ok = await deleteFallbackUser(targetId);
      if (!ok) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }
      return res.json({
        id: targetId,
        message: "Usuario eliminado correctamente",
      });
    }
    res.status(500).json({ message: error.message });
  }
};
