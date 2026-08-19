import { Router } from "express";
import { profileController } from "../controllers/profile.controller";
import { requireAuth, requireRole } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import { avatarUpload, validateUploadedImage } from "../utils/storage";
import { updateProfileSchema } from "../validation/profile.schemas";

export const profileRouter = Router();

const ownerOnly = [requireAuth, requireRole("BUSINESS_OWNER")];

profileRouter.get("/", ...ownerOnly, profileController.getProfile);
profileRouter.patch(
  "/",
  ...ownerOnly,
  validate(updateProfileSchema),
  profileController.updateProfile
);
profileRouter.post(
  "/avatar",
  ...ownerOnly,
  avatarUpload.single("avatar"),
  validateUploadedImage,
  profileController.uploadAvatar
);