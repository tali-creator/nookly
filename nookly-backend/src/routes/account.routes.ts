import { Router } from "express";
import { accountController } from "../controllers/account.controller";
import { requireAuth, requireRole } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import { changePasswordSchema } from "../validation/profile.schemas";

export const accountRouter = Router();

const ownerOnly = [requireAuth, requireRole("BUSINESS_OWNER")];

accountRouter.patch(
  "/password",
  ...ownerOnly,
  validate(changePasswordSchema),
  accountController.changePassword
);