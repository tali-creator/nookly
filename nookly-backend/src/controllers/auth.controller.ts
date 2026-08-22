import type { NextFunction, Request, Response } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { UserRole } from "@prisma/client";
import prisma from "../models/prisma";
import { signToken } from "../utils/jwt";
import { HttpError } from "../utils/http-error";
import { env } from "../config/env";
import { sendEmail } from "../lib/email/send";
import { passwordResetTemplate } from "../lib/email/templates/passwordReset";
import type {
  ForgotPasswordInput,
  LoginInput,
  ResetPasswordInput,
  SignupInput,
} from "../validation/auth.schemas";

const INVALID_CREDENTIALS = "Invalid email or password";
const BCRYPT_ROUNDS = 10;
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes
const RESET_LINK_MESSAGE =
  "If an account exists for this email, a reset link has been sent";

// Sentinel hash for timing-equalization dummy work in login/forgot-password.
// Hashed once at boot with the same cost as real passwords, so the bcrypt
// comparison for a NON-existent user costs statistically the same as the real
// comparison for an existing user — preventing account enumeration via
// response-time correlation. Deliberately not tied to any real account.
const DUMMY_PASSWORD = "timing-equalization-sentinel";
const DUMMY_HASH = bcrypt.hashSync(DUMMY_PASSWORD, BCRYPT_ROUNDS);

// Run a throwaway bcrypt comparison so an unknown-email response costs about
// as much as a known-email wrong-password response. Result is irrelevant; the
// work is the point.
async function dummyBcryptWork(): Promise<void> {
  try {
    await bcrypt.compare(DUMMY_PASSWORD, DUMMY_HASH);
  } catch {
    // The sentinel hash is valid; a failure here is unexpected but must never
    // break the request path.
  }
}

function publicUser(user: {
  id: string;
  email: string;
  role: UserRole;
  displayName?: string | null;
}) {
  // name = displayName when set, else undefined so clients can fall back
  // to the email address (e.g. "Nookly workspace" card shows the username
  // once the owner has updated their profile, email before that).
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.displayName || undefined,
  };
}

async function signup(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const body = req.body as SignupInput;
    const email = body.email.trim().toLowerCase();

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new HttpError(409, "An account with this email already exists");
    }

    const passwordHash = await bcrypt.hash(body.password, BCRYPT_ROUNDS);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: body.role,
        dateOfBirth: body.dateOfBirth ?? null,
      },
    });

    const token = signToken({
      id: user.id,
      role: user.role,
      pwdChangedAt: user.passwordChangedAt.getTime(),
    });
    res.status(201).json({ user: publicUser(user), token });
  } catch (err) {
    next(err);
  }
}

async function login(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const body = req.body as LoginInput;
    const email = body.email.trim().toLowerCase();

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Timing equalization: burn ~one bcrypt compare so unknown emails
      // respond as slowly as known emails with wrong passwords, denying an
      // attacker a reliable existence oracle. See dummyBcryptWork.
      await dummyBcryptWork();
      throw new HttpError(401, INVALID_CREDENTIALS);
    }

    const valid = await bcrypt.compare(body.password, user.passwordHash);
    if (!valid) {
      throw new HttpError(401, INVALID_CREDENTIALS);
    }

    // Archived (soft-deleted) accounts cannot sign in. The check runs AFTER
    // the bcrypt compare so we don't reveal whether an email exists.
    if (user.deletedAt) {
      throw new HttpError(401, INVALID_CREDENTIALS);
    }

    const token = signToken({
      id: user.id,
      role: user.role,
      pwdChangedAt: user.passwordChangedAt.getTime(),
    });
    res.status(200).json({ user: publicUser(user), token });
  } catch (err) {
    next(err);
  }
}

async function me(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new HttpError(401, "Authentication required");
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new HttpError(401, "Invalid or expired token");
    }

    res.status(200).json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
}

// SHA-256 of the raw token. Only the hash is ever stored, so a DB leak cannot
// be used to mint working reset links (same principle as password hashing).
function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function forgotPassword(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const body = req.body as ForgotPasswordInput;
    const email = body.email.trim().toLowerCase();

    const user = await prisma.user.findUnique({ where: { email } });

    // Always respond identically whether or not the account exists, so an
    // attacker cannot probe which emails are registered. Timing equalization
    // too: when no account exists, burn the same dummy bcrypt work the
    // existing-account branch does (token generation is negligible), so
    // response time doesn't reveal existence either.
    if (user) {
      const rawToken = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

      // Invalidate any previous unused tokens so only the newest link works.
      await prisma.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      });

      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(rawToken),
          expiresAt,
        },
      });

      // Timing equalization (same as the non-existent branch): burn one
      // bcrypt compare here too, so the existing-account path costs similar
      // CPU and the two branches can't be distinguished by response time.
      await dummyBcryptWork();

      const resetUrl = `${env.frontendUrl}/reset-password.html?token=${rawToken}`;
      try {
        await sendEmail({ to: user.email, ...passwordResetTemplate({ resetUrl }) });
      } catch (err) {
        // Email must never break the request; the generic response is still
        // returned so the endpoint does not reveal account existence.
        console.error("[nookly:email] password reset email failed:", err);
      }
    } else {
      await dummyBcryptWork();
    }

    // NOTE: the 429 rate-limit response (3/hour per email) is a KNOWN, accepted
    // minor leak: hitting it reveals that someone recently requested resets for
    // a given address. This is inherent to per-email rate limiting and is
    // considered a reasonable tradeoff — the generic 200/401-style response
    // above still never distinguishes existing vs non-existing accounts.

    res.status(200).json({ message: RESET_LINK_MESSAGE });
  } catch (err) {
    next(err);
  }
}

async function resetPassword(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const body = req.body as ResetPasswordInput;
    const tokenHash = hashToken(body.token);

    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });

    const valid =
      record &&
      record.usedAt === null &&
      record.expiresAt.getTime() > Date.now();
    if (!valid) {
      throw new HttpError(
        400,
        "This reset link is invalid or has expired, please request a new one"
      );
    }

    const passwordHash = await bcrypt.hash(body.newPassword, BCRYPT_ROUNDS);

    await prisma.$transaction([
      // Mark the token consumed so it cannot be reused.
      prisma.passwordResetToken.update({
        where: { id: record!.id },
        data: { usedAt: new Date() },
      }),
      // passwordChangedAt = now also invalidates any JWTs that predate the
      // reset (requireAuth compares the token's embedded stamp).
      prisma.user.update({
        where: { id: record!.userId },
        data: { passwordHash, passwordChangedAt: new Date() },
      }),
    ]);

    res.status(200).json({ message: "Password reset successful" });
  } catch (err) {
    next(err);
  }
}

export const authController = { signup, login, me, forgotPassword, resetPassword };
