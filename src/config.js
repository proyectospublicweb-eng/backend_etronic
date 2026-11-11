export const KEY_SECRET = process.env.KEY_SECRET;
export const ADMIN_EMAIL = (
  process.env.ADMIN_EMAIL || "adminetronic27@gmail.com"
)
  .trim()
  .toLowerCase();
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";

const DAY_MS = 24 * 60 * 60 * 1000;

// Sesión sin "Recordarme": cookie de sesión (se borra al cerrar el navegador).
const SESSION_TTL_DAYS = Number(process.env.SESSION_TTL_DAYS) || 1;
// Sesión con "Recordarme": cookie persistente + renovación deslizante.
const REMEMBER_TTL_DAYS = Number(process.env.REMEMBER_TTL_DAYS) || 30;

export const sessionTtlMs = SESSION_TTL_DAYS * DAY_MS;
export const rememberTtlMs = REMEMBER_TTL_DAYS * DAY_MS;

// TTL efectivo (ms) según "Recordarme".
export const ttlMsFor = (remember) => (remember ? rememberTtlMs : sessionTtlMs);

// La renovación deslizante actúa cuando queda menos de la mitad del TTL.
export const renewThresholdMs = (remember) =>
  Math.floor(ttlMsFor(remember) / 2);

const baseCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.COOKIE_SAMESITE || "lax",
};

// Cookie persistente (maxAge) si "Recordarme"; cookie de sesión si no.
export const cookieOptionsFor = (remember) =>
  remember
    ? { ...baseCookieOptions, maxAge: rememberTtlMs }
    : baseCookieOptions;

// Para borrar la cookie (logout): sin maxAge.
export const clearCookieOptions = baseCookieOptions;
