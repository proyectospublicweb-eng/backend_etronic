import { z } from "zod";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_CHARS_REGEX = /^\+?[\d\s()-]{7,20}$/;

function isValidEmailOrPhone(value) {
  const clean = String(value || "").trim();
  if (!clean) return false;
  if (EMAIL_REGEX.test(clean)) return true;
  const digits = clean.replace(/\D/g, "");
  return PHONE_CHARS_REGEX.test(clean) && digits.length >= 7 && digits.length <= 15;
}

export const visitorChatMessageSchema = z.object({
  sessionKey: z
    .string({ required_error: "La clave de sesión es requerida" })
    .trim()
    .min(6, { message: "Clave de sesión inválida" })
    .max(80),
  nombre: z
    .string({ required_error: "El campo Nombre es obligatorio" })
    .trim()
    .min(2, { message: "El campo Nombre es obligatorio (mínimo 2 caracteres)" })
    .max(140),
  contacto: z
    .string({ required_error: "El campo Correo o Tel-Whatsapp es obligatorio" })
    .trim()
    .min(1, { message: "El campo Correo o Tel-Whatsapp es obligatorio" })
    .max(180)
    .refine(isValidEmailOrPhone, {
      message: "Ingresa un Correo electrónico válido o un número de Tel-Whatsapp válido",
    }),
  mensaje: z
    .string({ required_error: "El mensaje es requerido" })
    .trim()
    .min(1, { message: "Escribe un mensaje antes de enviar" })
    .max(2000),
});

export const updateChatAdminSchema = z.object({
  estado: z.enum(["pendiente", "en_seguimiento", "atendido"]).optional(),
  notas_seguimiento: z.string().max(3000).optional(),
  marcarLeido: z.boolean().optional(),
});

export const replyChatAdminSchema = z.object({
  mensaje: z
    .string({ required_error: "El mensaje de respuesta es requerido" })
    .trim()
    .min(1, { message: "Escribe una respuesta antes de enviar" })
    .max(2000),
});
