import type { NextFunction, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { UserRole } from "@prisma/client";
import prisma from "../models/prisma";
import { HttpError } from "../utils/http-error";
import { getParam } from "../utils/params";
import { writeAuditLog } from "../lib/audit";
import type {
  CreateUserInput,
  ListUsersQuery,
  UpdateUserInput,
} from "../validation/admin.schemas";

const BCRYPT_ROUNDS = 10;

// Directory select: NEVER passwordHash, NEVER KYC documents/NIN (even masked).
// This is a user directory, not a KYC review screen — admins go to
// GET /admin/kyc/:userId for KYC detail.
const USER_SELECT = {
  id: true,
  email: true,
  role: true,
  displayName: true,
  phone: true,
  kycStatus: true,
  createdAt: true,
} as const;

async function list(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { page, limit, role, kycStatus, q, deleted } =
      res.locals.validatedQuery as ListUsersQuery;

    const where: Record<string, unknown> = {
      deletedAt: deleted === "true" ? { not: null } : null,
    };
    if (role) where.role = role;
    if (kycStatus) where.kycStatus = kycStatus;
    if (q) {
      where.OR = [
        { email: { contains: q, mode: "insensitive" } },
        { displayName: { contains: q, mode: "insensitive" } },
      ];
    }

    const [users, total] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        select: USER_SELECT,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    const ids = users.map((u) => u.id);
    const counts = ids.length
      ? await prisma.business.groupBy({
          by: ["ownerId"],
          where: { ownerId: { in: ids } },
          _count: { _all: true },
        })
      : [];

    const countByOwner = new Map(counts.map((c) => [c.ownerId, c._count._all]));

    const data = users.map((u) => ({
      id: u.id,
      email: u.email,
      role: u.role,
      displayName: u.displayName,
      phone: u.phone,
      kycStatus: u.kycStatus,
      createdAt: u.createdAt,
      businessCount: countByOwner.get(u.id) ?? 0,
    }));

    res.status(200).json({ data, total, page, limit });
  } catch (err) {
    next(err);
  }
}

async function getOne(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: getParam(req, "id") },
      select: {
        ...USER_SELECT,
        deletedAt: true,
        businesses: {
          select: { id: true, name: true, status: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (!user) {
      throw new HttpError(404, "User not found");
    }

    res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        displayName: user.displayName,
        phone: user.phone,
        kycStatus: user.kycStatus,
        createdAt: user.createdAt,
        deletedAt: user.deletedAt,
        businessCount: user.businesses.length,
        businesses: user.businesses,
      },
    });
  } catch (err) {
    next(err);
  }
}

// POST /admin/users — admin creates an account (owner or admin colleague).
// Mirrors the public signup hashing path; role is admin-controlled.
async function create(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const body = req.body as CreateUserInput;
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
        displayName: body.displayName ?? null,
        phone: body.phone ?? null,
      },
      select: USER_SELECT,
    });

    writeAuditLog({
      actorId: req.user!.id,
      actorRole: req.user!.role,
      action: "create",
      targetType: "user",
      targetId: user.id,
      metadata: { email: user.email, role: user.role },
    });
    res.status(201).json({ user });
  } catch (err) {
    next(err);
  }
}

// PATCH /admin/users/:id — admin edits profile fields. Email stays fixed;
// role changes are allowed. Never touches passwordHash or KYC state here.
async function update(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const body = req.body as UpdateUserInput;
    const id = getParam(req, "id");
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new HttpError(404, "User not found");
    }
    if (existing.deletedAt) {
      throw new HttpError(400, "Cannot edit an archived user; restore it first");
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        displayName: body.displayName,
        phone: body.phone,
        role: body.role,
      },
      select: USER_SELECT,
    });

    writeAuditLog({
      actorId: req.user!.id,
      actorRole: req.user!.role,
      action: "update",
      targetType: "user",
      targetId: user.id,
      metadata: {
        changed: {
          displayName: body.displayName !== undefined,
          phone: body.phone !== undefined,
          role: body.role !== undefined,
        },
      },
    });
    res.status(200).json({ user });
  } catch (err) {
    next(err);
  }
}

// DELETE /admin/users/:id — soft delete (archive). The account stops being
// able to log in, is hidden from the directory, and its businesses are
// effectively off the market (they remain in the DB for the audit trail).
// Restorable via POST /admin/users/:id/restore.
async function softDelete(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = getParam(req, "id");
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new HttpError(404, "User not found");
    }
    if (existing.deletedAt) {
      throw new HttpError(400, "User is already archived");
    }

    const user = await prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
      select: USER_SELECT,
    });

    writeAuditLog({
      actorId: req.user!.id,
      actorRole: req.user!.role,
      action: "delete",
      targetType: "user",
      targetId: user.id,
      metadata: { email: user.email },
    });
    res.status(200).json({ user });
  } catch (err) {
    next(err);
  }
}

// POST /admin/users/:id/restore — undo a soft delete. Idempotent: restoring
// an already-active user is a no-op success (not an error).
async function restore(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = getParam(req, "id");
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new HttpError(404, "User not found");
    }

    const user = await prisma.user.update({
      where: { id },
      data: { deletedAt: null },
      select: USER_SELECT,
    });

    writeAuditLog({
      actorId: req.user!.id,
      actorRole: req.user!.role,
      action: "restore",
      targetType: "user",
      targetId: user.id,
      metadata: { email: user.email },
    });
    res.status(200).json({ user });
  } catch (err) {
    next(err);
  }
}

export const adminUsersController = { list, getOne, create, update, softDelete, restore };