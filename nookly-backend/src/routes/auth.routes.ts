import { Router } from "express";
import { authController } from "../controllers/auth.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import { createRateLimiter } from "../lib/rate-limit";
import { clientIp } from "../lib/client-ip";
import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
} from "../validation/auth.schemas";

export const authRouter = Router();

// Public — these are how you get BACK INTO your account, so no auth required.
// Rate limited per email (3/hour) to stop flooding/enumeration.
const forgotPasswordLimiter = createRateLimiter({
  max: 3,
  windowMs: 60 * 60 * 1000,
  getKey: (req) =>
    typeof req.body?.email === "string" ? `forgot-password:${req.body.email}` : null,
  message: "Too many password reset requests for this email, please try again later",
});

// Login brute-force protection, two independent layers:
//  1. per-email: 5 wrong attempts per 15 minutes (stops guessing one account)
//  2. per-IP: 20 attempts per hour (stops distributed attacks across many
//     emails from the same machine)
// Both must pass for the request to reach the login handler. Keyed before
// validation on whatever is present in the body — an attacker cannot evade
// either bucket by omitting the email, since a missing email keys to null and
// is handled by validation afterwards.
const loginEmailLimiter = createRateLimiter({
  max: 5,
  windowMs: 15 * 60 * 1000,
  getKey: (req) =>
    typeof req.body?.email === "string" ? `login:email:${req.body.email}` : null,
  message: "Too many login attempts for this email, please try again later",
});

const loginIpLimiter = createRateLimiter({
  max: 20,
  windowMs: 60 * 60 * 1000,
  getKey: (req) => `login:ip:${clientIp(req)}`,
  message: "Too many login attempts from this device, please try again later",
});

authRouter.post("/signup", validate(signupSchema), authController.signup);
authRouter.post(
  "/login",
  loginIpLimiter,
  loginEmailLimiter,
  validate(loginSchema),
  authController.login
);
authRouter.get("/me", requireAuth, authController.me);
authRouter.post(
  "/forgot-password",
  forgotPasswordLimiter,
  validate(forgotPasswordSchema),
  authController.forgotPassword
);
authRouter.post(
  "/reset-password",
  validate(resetPasswordSchema),
  authController.resetPassword
);