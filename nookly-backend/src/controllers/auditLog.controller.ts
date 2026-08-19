import type { NextFunction, Request, Response } from "express";
import prisma from "../models/prisma";
import { HttpError } from "../utils/http-error";
import type { ListAuditLogQuery } from "../validation/admin.schemas";

async function listAuditLog(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { page, limit } = res.locals.validatedQuery as ListAuditLogQuery;

    const [data, total] = await prisma.$transaction([
      prisma.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.auditLog.count(),
    ]);

    res.status(200).json({ data, total, page, limit });
  } catch (err) {
    next(err);
  }
}

export const auditLogController = { listAuditLog };