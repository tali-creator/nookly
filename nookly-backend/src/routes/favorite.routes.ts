import type { NextFunction, Request, RequestHandler, Response } from "express";
import { Router } from "express";
import { favoriteController } from "../controllers/favorite.controller";
import { createRateLimiter } from "../lib/rate-limit";
import { clientIp } from "../lib/client-ip";
import { validate, validateQuery } from "../middleware/validate.middleware";
import {
  favoriteBodySchema,
  favoritesCheckQuerySchema,
  favoritesListQuerySchema,
} from "../validation/favorite.schemas";

export const favoriteRouter = Router();

// Public, unauthenticated route: basic abuse protection for POST /favorites.
// Two independent layers must BOTH pass:
//   - per deviceId: 100 writes/hour (deviceId is client-generated, so this
//     alone is bypassable by rotating it)
//   - per client IP: 100 writes/hour (defense against deviceId rotation)
// See lib/rate-limit.ts re: Redis in production.
const favoriteDeviceLimiter = createRateLimiter({
  max: 100,
  windowMs: 60 * 60 * 1000,
  getKey: (req) =>
    (req.body as { deviceId?: string } | undefined)?.deviceId ?? null,
});

const favoriteIpLimiter = createRateLimiter({
  max: 100,
  windowMs: 60 * 60 * 1000,
  getKey: (req) => `favorites:ip:${clientIp(req)}`,
});

favoriteRouter.post(
  "/",
  favoriteIpLimiter,
  favoriteDeviceLimiter,
  validate(favoriteBodySchema),
  favoriteController.add
);
favoriteRouter.delete("/", validate(favoriteBodySchema), favoriteController.remove);
favoriteRouter.get("/", validateQuery(favoritesListQuerySchema), favoriteController.list);
favoriteRouter.get(
  "/check",
  validateQuery(favoritesCheckQuerySchema),
  favoriteController.check
);