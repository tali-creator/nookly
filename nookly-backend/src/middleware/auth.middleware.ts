import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { UserRole } from "@prisma/client";
import prisma from "../models/prisma";
import { verifyToken } from "../utils/jwt";

const TOKEN_MISSING = "Authentication required";
const TOKEN_STALE = "Session expired, please log in again";

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ error: TOKEN_MISSING });
    return;
  }

  const token = header.slice("Bearer ".length).trim();
  if (!token) {
    res.status(401).json({ error: TOKEN_MISSING });
    return;
  }

  try {
    const payload = verifyToken(token);

    // Stale-token check: every token embeds the user's passwordChangedAt
    // (epoch ms) from when it was issued. If the password has changed since,
    // the token predates that change and is rejected. This makes old tokens
    // (including leaked ones) die the moment a password rotates.
    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: { passwordChangedAt: true, deletedAt: true },
    });
    if (!user) {
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }
    // Archived (soft-deleted) accounts are banned: any token they still hold
    // dies immediately, and they cannot authenticate again.
    if (user.deletedAt) {
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }
    if (
      typeof payload.pwdChangedAt === "number" &&
      payload.pwdChangedAt < user.passwordChangedAt.getTime()
    ) {
      res.status(401).json({ error: TOKEN_STALE });
      return;
    }

    req.user = { id: payload.id, role: payload.role };
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function requireRole(...roles: UserRole[]): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: TOKEN_MISSING });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  };
}
