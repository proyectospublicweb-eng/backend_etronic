import {
  cookieOptionsFor,
  ttlMsFor,
  renewThresholdMs,
} from "../config.js";
import { createAccessToken } from "./jwt.js";

// Renovación deslizante: para sesiones "Recordarme" con poco tiempo restante,
// reemite el token y reinicia la cookie persistente. Si algo falla, no se
// interrumpe la petición (solo se registra).
export const renewSessionIfNeeded = async (user, res) => {
  if (!user?.remember || !user.exp) return;

  const remainingMs = user.exp * 1000 - Date.now();
  if (remainingMs >= renewThresholdMs(true)) return;

  try {
    const fresh = await createAccessToken(
      {
        id: user.id,
        correoRegistro: user.correoRegistro,
        rol: user.rol || "usuario",
        version: user.version,
        remember: true,
      },
      ttlMsFor(true)
    );
    res.cookie("token", fresh, cookieOptionsFor(true));
  } catch (error) {
    console.error("[auth] No se pudo renovar la sesión:", error.message);
  }
};
