import jwt from "jsonwebtoken";
import type { UserRole } from "@prisma/client";
import { env } from "../config/env";

export interface JwtPayload {
  id: string;
  role: UserRole;
  // Epoch ms of the user's passwordChangedAt at the time the token was
  // issued. requireAuth compares this to the current DB value to revoke
  // tokens issued before a password change.
  pwdChangedAt?: number;
}

const TOKEN_EXPIRY = "7d";

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: TOKEN_EXPIRY });
}

export function verifyToken(token: string): JwtPayload {
  // algorithms is pinned to HS256 explicitly. jsonwebtoken happens to default
  // to HS256 for a string secret, but never rely on that: an explicit list
  // makes the accepted algorithm set auditable and blocks algorithm-confusion
  // attacks (e.g. "alg":"none" or asymmetric-key confusion) even if the
  // default behavior ever changes.
  return jwt.verify(token, env.jwtSecret, { algorithms: ["HS256"] }) as JwtPayload;
}