import { Router } from "express";
import { adminController } from "../controllers/admin.controller";
import { adminKycController } from "../controllers/adminKyc.controller";
import { adminUsersController } from "../controllers/adminUsers.controller";
import { auditLogController } from "../controllers/auditLog.controller";
import { requireAuth, requireRole } from "../middleware/auth.middleware";
import { validate, validateQuery } from "../middleware/validate.middleware";
import {
  createUserSchema,
  featureBusinessSchema,
  listAuditLogQuerySchema,
  listBusinessesQuerySchema,
  listUsersQuerySchema,
  moderationReasonSchema,
  updateUserSchema,
} from "../validation/admin.schemas";
import { listKycQuerySchema } from "../validation/kyc.schemas";

export const adminRouter = Router();

const adminOnly = [requireAuth, requireRole("ADMIN")];

adminRouter.get(
  "/businesses",
  ...adminOnly,
  validateQuery(listBusinessesQuerySchema),
  adminController.list
);
adminRouter.get("/businesses/:id", ...adminOnly, adminController.getOne);
adminRouter.patch(
  "/businesses/:id/approve",
  ...adminOnly,
  adminController.approve
);
adminRouter.patch(
  "/businesses/:id/reject",
  ...adminOnly,
  validate(moderationReasonSchema),
  adminController.reject
);
adminRouter.patch(
  "/businesses/:id/suspend",
  ...adminOnly,
  validate(moderationReasonSchema),
  adminController.suspend
);
adminRouter.patch(
  "/businesses/:id/feature",
  ...adminOnly,
  validate(featureBusinessSchema),
  adminController.feature
);
adminRouter.patch(
  "/businesses/:id/unfeature",
  ...adminOnly,
  adminController.unfeature
);

// KYC review. Note: /admin/kyc/:userId/documents/:field must be registered
// before any /admin/kyc/:userId route that would shadow it? No — Express
// matches in registration order and the document routes use a distinct
// segment (:userId/documents/:field), so ordering among these is safe.
adminRouter.get(
  "/kyc",
  ...adminOnly,
  validateQuery(listKycQuerySchema),
  adminKycController.list
);
adminRouter.get(
  "/audit-log",
  ...adminOnly,
  validateQuery(listAuditLogQuerySchema),
  auditLogController.listAuditLog
);
adminRouter.get(
  "/users",
  ...adminOnly,
  validateQuery(listUsersQuerySchema),
  adminUsersController.list
);
adminRouter.get("/users/:id", ...adminOnly, adminUsersController.getOne);
adminRouter.post(
  "/users",
  ...adminOnly,
  validate(createUserSchema),
  adminUsersController.create
);
adminRouter.patch(
  "/users/:id",
  ...adminOnly,
  validate(updateUserSchema),
  adminUsersController.update
);
adminRouter.delete("/users/:id", ...adminOnly, adminUsersController.softDelete);
adminRouter.post(
  "/users/:id/restore",
  ...adminOnly,
  adminUsersController.restore
);
adminRouter.get(
  "/kyc/:userId/documents/:field",
  ...adminOnly,
  adminKycController.getDocument
);
adminRouter.get("/kyc/:userId", ...adminOnly, adminKycController.getOne);
adminRouter.patch(
  "/kyc/:userId/verify",
  ...adminOnly,
  adminKycController.verify
);
adminRouter.patch(
  "/kyc/:userId/reject",
  ...adminOnly,
  validate(moderationReasonSchema),
  adminKycController.reject
);
