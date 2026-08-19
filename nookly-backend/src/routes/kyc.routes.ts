import { Router } from "express";
import { kycController } from "../controllers/kyc.controller";
import { requireAuth, requireRole } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import { createRateLimiter } from "../lib/rate-limit";
import { kycDocumentUpload, validateUploadedImage } from "../utils/storage";
import { kycSubmissionBodySchema } from "../validation/kyc.schemas";

export const kycRouter = Router();

const ownerOnly = [requireAuth, requireRole("BUSINESS_OWNER")];

// KYC submissions are sensitive: cap resubmissions at 5 per user per day.
const kycSubmitLimiter = createRateLimiter({
  max: 5,
  windowMs: 24 * 60 * 60 * 1000,
  getKey: (req) => (req.user?.id ? `kyc:${req.user.id}` : null),
  message: "Too many KYC submissions today, please try again tomorrow",
});

// Rate limit BEFORE multer so a throttled request never writes files to disk.
// validateUploadedImage runs after multer has written the files but before the
// controller: every uploaded document's magic bytes must be a real image.
kycRouter.post(
  "/",
  ...ownerOnly,
  kycSubmitLimiter,
  kycDocumentUpload.fields([
    { name: "selfie", maxCount: 1 },
    { name: "certificate", maxCount: 1 },
    { name: "proofOfAddressHome", maxCount: 1 },
    { name: "proofOfAddressWorkshop", maxCount: 1 },
  ]),
  validateUploadedImage,
  validate(kycSubmissionBodySchema),
  kycController.submit
);
kycRouter.get("/", ...ownerOnly, kycController.getMyKyc);
kycRouter.get("/documents/:field", ...ownerOnly, kycController.getMyDocument);