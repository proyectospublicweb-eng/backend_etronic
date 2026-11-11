import { z } from "zod";

export const createUserAdminSchema = z.object({
  correoRegistro: z
    .string({ required_error: "El correo es requerido" })
    .email({ message: "Correo no válido" }),
  password: z
    .string({ required_error: "La contraseña es requerida" })
    .min(6, { message: "La contraseña debe tener al menos 6 caracteres" }),
  rol: z.enum(["admin", "usuario"]).default("usuario"),
});

export const updateRoleSchema = z.object({
  rol: z.enum(["admin", "usuario"], {
    required_error: "El rol es requerido ('admin' o 'usuario')",
  }),
});
