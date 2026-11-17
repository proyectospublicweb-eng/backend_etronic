import { Router } from "express";
import { authRequired, adminRequired } from "../middlewares/validateToken.js";
import { validateSchema } from "../middlewares/validator.middleware.js";
import {
  createUserAdminSchema,
  updateRoleSchema,
} from "../schemas/admin.schema.js";
import {
  updateChatAdminSchema,
  replyChatAdminSchema,
} from "../schemas/chat.schema.js";
import { updatePlannerAdminSchema } from "../schemas/planner.schema.js";
import {
  getDashboardStats,
  listUsers,
  createUserByAdmin,
  updateUserRole,
  deleteUserByAdmin,
} from "../controllers/admin.controller.js";
import {
  getAdminChats,
  patchAdminChat,
  postAdminChatReply,
  deleteAdminChat,
} from "../controllers/chat.controller.js";
import {
  getAdminPlannerSubmissions,
  patchAdminPlannerSubmission,
  deleteAdminPlannerSubmission,
} from "../controllers/planner.controller.js";

const router = Router();

router.use(authRequired, adminRequired);

router.get("/stats", getDashboardStats);
router.get("/users", listUsers);
router.post("/users", validateSchema(createUserAdminSchema), createUserByAdmin);
router.patch(
  "/users/:id/role",
  validateSchema(updateRoleSchema),
  updateUserRole
);
router.delete("/users/:id", deleteUserByAdmin);

// Control & Soporte (Mensajes de Chat)
router.get("/chats", getAdminChats);
router.patch(
  "/chats/:id",
  validateSchema(updateChatAdminSchema),
  patchAdminChat
);
router.post(
  "/chats/:id/reply",
  validateSchema(replyChatAdminSchema),
  postAdminChatReply
);
router.delete("/chats/:id", deleteAdminChat);

// Planificador de proyectos (Registros de clientes)
router.get("/planner", getAdminPlannerSubmissions);
router.patch(
  "/planner/:id",
  validateSchema(updatePlannerAdminSchema),
  patchAdminPlannerSubmission
);
router.delete("/planner/:id", deleteAdminPlannerSubmission);

export default router;
