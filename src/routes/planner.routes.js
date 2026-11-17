import { Router } from "express";
import { validateSchema } from "../middlewares/validator.middleware.js";
import { createPlannerSubmissionSchema } from "../schemas/planner.schema.js";
import { postPlannerSubmission } from "../controllers/planner.controller.js";

const router = Router();

router.post(
  "/submissions",
  validateSchema(createPlannerSubmissionSchema),
  postPlannerSubmission
);

export default router;
