import { Router } from "express";
import { serviceController } from "../controllers/service.controller";
import { requireAuth, requireRole } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import { imageUpload, validateUploadedImage } from "../utils/storage";
import { serviceItemSchema } from "../validation/business.schemas";

const ownerOnly = [requireAuth, requireRole("BUSINESS_OWNER")];

export const serviceRouter = Router();

serviceRouter.patch(
  "/:id",
  ...ownerOnly,
  validate(serviceItemSchema.partial()),
  serviceController.updateService
);
serviceRouter.delete("/:id", ...ownerOnly, serviceController.deleteService);

// Service item photo. Ownership of the service is verified inside the
// controller via the parent business (the URL param is the SERVICE id, so the
// requireBusinessOwner middleware cannot be reused directly). Magic-byte
// validation runs after multer writes the file, so a renamed non-image is
// rejected regardless of declared Content-Type/extension.
serviceRouter.post(
  "/:id/photo",
  ...ownerOnly,
  imageUpload.single("photo"),
  validateUploadedImage,
  serviceController.uploadPhoto
);
serviceRouter.delete(
  "/:id/photo",
  ...ownerOnly,
  serviceController.deletePhoto
);