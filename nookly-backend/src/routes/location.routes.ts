import { Router } from "express";
import { geocode } from "../lib/geocode";
import { createRateLimiter } from "../lib/rate-limit";
import { clientIp } from "../lib/client-ip";

export const locationRouter = Router();

// Public, unauthenticated. Low volume + 24h in-memory cache keeps us well
// within Nominatim's fair-use policy (max 1 req/s).
const limiter = createRateLimiter({
  max: 60,
  windowMs: 60 * 1000,
  getKey: (req) => `geocode:${clientIp(req)}`,
});

locationRouter.get("/search", limiter, async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q : "";
  const results = await geocode(q);
  res.json({ results });
});
