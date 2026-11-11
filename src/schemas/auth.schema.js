import { z } from "zod";

export const registerSchema = z.object({
  correoRegistro: z
    .string({ required_error: "correoRegistro es requerido" })
    .email({ message: "Correo no válido" }),
  password: z
    .string({ required_error: "password es requerido" })
    .min(6, { message: "La contraseña debe tener al menos 6 caracteres" }),
  remember: z.boolean().optional(),
});

export const loginSchema = z.object({
  correoRegistro: z
    .string({ required_error: "correoRegistro es requerido" })
    .email({ message: "Correo no válido" }),
  password: z.string({ required_error: "password es requerido" }),
  remember: z.boolean().optional(),
});
