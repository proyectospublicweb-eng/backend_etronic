import { z } from "zod";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_CHARS_REGEX = /^\+?[\d\s()-]{7,20}$/;

function isValidContactValue(value) {
  const clean = String(value || "").trim();
  if (!clean) return false;
  if (EMAIL_REGEX.test(clean)) return true;
  const digits = clean.replace(/\D/g, "");
  return PHONE_CHARS_REGEX.test(clean) && digits.length >= 7 && digits.length <= 15;
}

const plannerTaskSchema = z.object({
  id: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(200),
});

const plannerProcessSchema = z.object({
  id: z.string().trim().min(1).max(80),
  group: z.string().trim().max(180).optional().nullable(),
  number: z.string().trim().min(1).max(20),
  title: z.string().trim().min(1).max(200),
  tasks: z.array(plannerTaskSchema).min(1),
});

const plannerServiceSummarySchema = z.object({
  id: z.string().trim().min(1).max(80),
  order: z.number().int().positive(),
  name: z.string().trim().min(1).max(200),
  totalTasks: z.number().int().nonnegative(),
  selectedCount: z.number().int().positive(),
  processes: z.array(plannerProcessSchema).min(1),
});

export const createPlannerSubmissionSchema = z.object({
  nombre: z
    .string({ required_error: "El campo Nombre es obligatorio" })
    .trim()
    .min(2, { message: "El campo Nombre es obligatorio (mínimo 2 caracteres)" })
    .max(140),
  telefonoWhatsapp: z
    .string()
    .trim()
    .max(180)
    .optional()
    .default("")
    .refine((val) => !val || isValidContactValue(val), {
      message: "Si ingresas Teléfono-Whatsapp / Correo, verifica que sea un número o correo válido",
    }),
  totalSeleccionadas: z.number().int().positive({
    message: "Debes seleccionar al menos una funcionalidad",
  }),
  resumenServicios: z
    .array(plannerServiceSummarySchema)
    .min(1, { message: "Debes seleccionar al menos una funcionalidad" }),
  comentarios: z.string().trim().max(2000).optional().default(""),
});

export const updatePlannerAdminSchema = z.object({
  estado: z.enum(["pendiente", "en_seguimiento", "atendido"]).optional(),
  notas_seguimiento: z.string().max(3000).optional(),
});
