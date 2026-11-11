import { z } from "zod";

export const visitorChatMessageSchema = z.object({
  sessionKey: z
    .string({ required_error: "La clave de sesión es requerida" })
    .trim()
    .min(6, { message: "Clave de sesión inválida" })
    .max(80),
  nombre: z
    .string({ required_error: "El nombre es requerido" })
    .trim()
    .min(2, { message: "Por favor ingresa tu nombre" })
    .max(140),
  contacto: z
    .string({ required_error: "El correo o Tel-WhatsApp es requerido" })
    .trim()
    .min(5, { message: "Por favor ingresa tu correo o Tel-WhatsApp" })
    .max(180),
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
