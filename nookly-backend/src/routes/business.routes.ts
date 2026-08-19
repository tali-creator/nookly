import { Router } from "express";
import { businessController } from "../controllers/business.controller";
import { photoController } from "../controllers/photo.controller";
import { serviceController } from "../controllers/service.controller";
import { analyticsController, rateLimitEvent } from "../controllers/analytics.controller";
import { requireAuth, requireRole } from "../middleware/auth.middleware";
import { requireBusinessOwner } from "../middleware/ownership.middleware";
import { validate, validateQuery } from "../middleware/validate.middleware";
import { imageUpload, validateUploadedImage } from "../utils/storage";
import { enforcePhotoLimit } from "./photo.routes";
import { nearbySearchQuerySchema, featuredListQuerySchema } from "../validation/search.schemas";
import { setBusinessHoursSchema } from "../validation/hours.schemas";
import {
  createBusinessSchema,
  serviceItemSchema,
  updateBusinessSchema,
} from "../validation/business.schemas";
import { analyticsEventBodySchema, analyticsQuerySchema } from "../validation/analytics.schemas";

export const businessRouter = Router();

const ownerOnly = [requireAuth, requireRole("BUSINESS_OWNER")];

businessRouter.post("/", ...ownerOnly, validate(createBusinessSchema), businessController.create);
businessRouter.get("/mine", ...ownerOnly, businessController.mine);
businessRouter.get(
  "/nearby",
  validateQuery(nearbySearchQuerySchema),
  businessController.nearby
);
businessRouter.get(
  "/featured",
  validateQuery(featuredListQuerySchema),
  businessController.featured
);
businessRouter.get("/:id", businessController.getPublicById);
businessRouter.patch(
  "/:id",
  ...ownerOnly,
  requireBusinessOwner("id"),
  validate(updateBusinessSchema),
  businessController.update
);
businessRouter.delete(
  "/:id",
  ...ownerOnly,
  requireBusinessOwner("id"),
  businessController.remove
);
businessRouter.post(
  "/:businessId/photos",
  ...ownerOnly,
  requireBusinessOwner("businessId"),
  enforcePhotoLimit,
  imageUpload.single("photo"),
  validateUploadedImage,
  photoController.addPhoto
);
businessRouter.post(
  "/:businessId/services",
  ...ownerOnly,
  requireBusinessOwner("businessId"),
  validate(serviceItemSchema),
  serviceController.addService
);
businessRouter.put(
  "/:businessId/hours",
  ...ownerOnly,
  requireBusinessOwner("businessId"),
  validate(setBusinessHoursSchema),
  businessController.setHours
);
businessRouter.get(
  "/:businessId/hours",
  ...ownerOnly,
  requireBusinessOwner("businessId"),
  businessController.getHours
);
businessRouter.post(
  "/:id/events",
  rateLimitEvent,
  validate(analyticsEventBodySchema),
  analyticsController.track
);
businessRouter.get(
  "/:id/analytics",
  ...ownerOnly,
  requireBusinessOwner("id"),
  validateQuery(analyticsQuerySchema),
  analyticsController.getAnalytics
);
