import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createAccessToken } from "../libs/jwt.js";
import { KEY_SECRET, cookieOptionsFor, clearCookieOptions, ttlMsFor } from "../config.js";
import { pool } from "../db.js";
import { renewSessionIfNeeded } from "../libs/session.js";
import {
  isDbUnavailableError,
  getFallbackUserByEmail,
  getFallbackUserById,
  createFallbackUser,
} from "../libs/adminBootstrap.js";

//#region Registrar Usuarios
export const register = async (req, res) => {
  const correoRegistro = req.body.correoRegistro.trim().toLowerCase();
  const { password } = req.body;
  const remember = req.body.remember !== false;

  let client;

  try {
    client = await pool.connect();

    await client.query("BEGIN");

    const resultList = await client.query(
      "SELECT idusuario FROM usuarios WHERE LOWER(correoRegistro)=LOWER($1)",
      [correoRegistro]
    );

    if (resultList.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: "El correo ingresado ya esta en uso!!!" });
    }

    const passwordCrypted = await bcrypt.hash(password, 10);

    const result = await client.query(
      "INSERT INTO usuarios(correoRegistro, password, rol) VALUES ($1, $2, 'usuario') RETURNING idUsuario, rol, token_version",
      [correoRegistro, passwordCrypted]
    );

    const idUsuario = result.rows[0].idusuario;
    const rol = result.rows[0].rol || "usuario";

    await client.query("COMMIT");

    const token = await createAccessToken(
      {
        id: idUsuario,
        correoRegistro,
        rol,
        version: result.rows[0].token_version,
        remember,
      },
      ttlMsFor(remember)
    );

    res.cookie("token", token, cookieOptionsFor(remember));
    res.json({
      id: idUsuario,
      correoRegistro,
      rol,
      token,
    });
  } catch (error) {
    await client?.query("ROLLBACK").catch(() => {});

    if (isDbUnavailableError(error)) {
      try {
        const created = await createFallbackUser({
          correoRegistro,
          password,
          rol: "usuario",
        });
        const token = await createAccessToken(
          {
            id: created.id,
            correoRegistro: created.correo,
            rol: created.rol,
            version: 0,
            remember,
          },
          ttlMsFor(remember)
        );
        res.cookie("token", token, cookieOptionsFor(remember));
        return res.json({
          id: created.id,
          correoRegistro: created.correo,
          rol: created.rol,
          token,
        });
      } catch (fallbackErr) {
        return res
          .status(fallbackErr.statusCode || 500)
          .json({ message: fallbackErr.message });
      }
    }

    res.status(500).json({ message: error.message });
  } finally {
    client?.release();
  }
};
//#endregion

//#region Logueo de Usuario
export const login = async (req, res) => {
  const correoRegistro = req.body.correoRegistro.trim();
  const { password } = req.body;
  const remember = req.body.remember !== false;

  try {
    let userRow = null;

    try {
      const result = await pool.query(
        "SELECT * FROM usuarios WHERE LOWER(correoRegistro)=LOWER($1)",
        [correoRegistro]
      );
      userRow = result.rows[0] || null;
    } catch (dbErr) {
      if (!isDbUnavailableError(dbErr)) throw dbErr;
      userRow = await getFallbackUserByEmail(correoRegistro);
    }

    if (!userRow) {
      return res.status(400).json({ message: "Usuario no encontrado!!" });
    }

    const validPassword = await bcrypt.compare(password, userRow.password);
    if (!validPassword) {
      return res.status(400).json({ message: "Contraseña inválida!!" });
    }

    const rol = userRow.rol || "usuario";

    const token = await createAccessToken(
      {
        id: userRow.idusuario,
        correoRegistro: userRow.correoregistro,
        rol,
        version: userRow.token_version ?? 0,
        remember,
      },
      ttlMsFor(remember)
    );

    res.cookie("token", token, cookieOptionsFor(remember));
    res.json({
      id: userRow.idusuario,
      correoRegistro: userRow.correoregistro,
      rol,
      token,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
//#endregion

//#region Logout
export const logout = (req, res) => {
  res.clearCookie("token", clearCookieOptions);
  console.log("El usuario ha terminado la sesión!!");
  return res.sendStatus(200);
};
//#endregion

//#region Verificación del Token
export const verifyToken = async (req, res) => {
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

      if (
        dbUser &&
        (user.version ?? 0) === (dbUser.token_version ?? 0)
      ) {
        const rol = dbUser.rol || "usuario";
        await renewSessionIfNeeded({ ...user, rol }, res);

        return res.json({
          id: dbUser.idusuario,
          correoRegistro: dbUser.correoregistro,
          rol,
          mensaje: "Validación-Token: OK!!",
        });
      } else {
        return res.status(401).json({ message: "No Autorizado" });
      }
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  });
};
//#endregion
