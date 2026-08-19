import { Router } from "express";
import { ownerController } from "../controllers/owner.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { createRateLimiter } from "../lib/rate-limit";
import { clientIp } from "../lib/client-ip";
import { validate } from "../middleware/validate.middleware";
import { recordVisitSchema } from "../validation/owner.schemas";

export const ownerRouter = Router();

// Public owner profile + their approved businesses. No auth required.
ownerRouter.get("/:id", ownerController.getPublicOwner);

// Public, unauthenticated visit tracking (same trust model as analytics
// events): the visitor is identified by a client-generated deviceId. Rate
// limits guard against inflation — per deviceId AND per client IP.
const visitDeviceLimiter = createRateLimiter({
  max: 1,
  windowMs: 5 * 60 * 1000,
  getKey: (req) =>
    (req.body as { deviceId?: string } | undefined)?.deviceId ?? null,
});

const visitIpLimiter = createRateLimiter({
  max: 20,
  windowMs: 5 * 60 * 1000,
  getKey: (req) => `owner-visits:ip:${clientIp(req)}`,
});

ownerRouter.post(
  "/:id/visits",
  visitIpLimiter,
  visitDeviceLimiter,
  validate(recordVisitSchema),
  ownerController.recordVisit
);

// Owner-only: total visitors to the owner's public profile.
ownerRouter.get("/me/visits", requireAuth, ownerController.getMyVisitors);