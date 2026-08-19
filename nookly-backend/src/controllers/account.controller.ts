import type { NextFunction, Request, Response } from "express";
import bcrypt from "bcryptjs";
import prisma from "../models/prisma";
import { HttpError } from "../utils/http-error";
import type { ChangePasswordInput } from "../validation/profile.schemas";

const BCRYPT_ROUNDS = 10;
const WRONG_CURRENT = "Current password is incorrect";

async function changePassword(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const body = req.body as ChangePasswordInput;

    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { passwordHash: true },
    });
    if (!user) {
      throw new HttpError(401, "Invalid or expired token");
    }

    const valid = await bcrypt.compare(body.currentPassword, user.passwordHash);
    if (!valid) {
      throw new HttpError(400, WRONG_CURRENT);
    }

    const passwordHash = await bcrypt.hash(body.newPassword, BCRYPT_ROUNDS);
    // passwordChangedAt = now: existing JWTs (which embed the previous
    // timestamp) are rejected by requireAuth from this point on, so a leaked
    // token stops working the moment the password rotates.
    await prisma.user.update({
      where: { id: req.user!.id },
      data: { passwordHash, passwordChangedAt: new Date() },
    });

    res.status(200).json({ message: "Password updated" });
  } catch (err) {
    next(err);
  }
}

export const accountController = { changePassword };