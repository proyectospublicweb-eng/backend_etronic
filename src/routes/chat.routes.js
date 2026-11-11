import { Router } from "express";
import { validateSchema } from "../middlewares/validator.middleware.js";
import { visitorChatMessageSchema } from "../schemas/chat.schema.js";
import {
  postVisitorMessage,
  getVisitorSession,
} from "../controllers/chat.controller.js";

const router = Router();

router.get("/session/:sessionKey", getVisitorSession);
router.post(
  "/messages",
  validateSchema(visitorChatMessageSchema),
  postVisitorMessage
);

export default router;
