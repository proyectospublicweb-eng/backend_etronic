import jwt from "jsonwebtoken";
import { KEY_SECRET } from "../config.js";
import { renewSessionIfNeeded } from "../libs/session.js";
import { pool } from "../db.js";
import {
  isDbUnavailableError,
  getFallbackUserById,
} from "../libs/adminBootstrap.js";

export const authRequired = (req, res, next) => {
  const { token } = req.cookies;

  if (!token) return res.status(401).json({ message: "No Autorizado" });

  jwt.verify(token, KEY_SECRET, async (err, user) => {
    if (err) return res.status(401).json({ message: "No Autorizado" });

    try {
      let dbUser = null;

      try {
        const result = await pool.query(
          "SELECT idusuario, correoregistro, rol, token_version FROM usuarios WHERE idUsuario=$1",
          [user.id]
        );
        dbUser = result.rows[0] || null;
      } catch (dbErr) {
        if (!isDbUnavailableError(dbErr)) throw dbErr;
        dbUser = await getFallbackUserById(user.id);
      }

      // Rechaza tokens de sesiones invalidadas (p. ej. tras cambiar la contraseña).
      if (!dbUser || (user.version ?? 0) !== (dbUser.token_version ?? 0)) {
        return res.status(401).json({ message: "No Autorizado" });
      }

      const enrichedUser = {
        ...user,
        id: dbUser.idusuario,
        correoRegistro: dbUser.correoregistro,
        rol: dbUser.rol || "usuario",
      };

      // Extiende la sesión "Recordarme" si está por expirar.
      await renewSessionIfNeeded(enrichedUser, res);

      req.user = enrichedUser;
      next();
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
};

export const adminRequired = (req, res, next) => {
  if (!req.user || req.user.rol !== "admin") {
    return res.status(403).json({
      message: "Acceso denegado: se requieren permisos de administrador",
    });
  }
  next();
};
