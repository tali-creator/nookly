import type { NextFunction, Request, Response } from "express";
import { BusinessStatus } from "@prisma/client";
import prisma from "../models/prisma";
import { HttpError } from "../utils/http-error";
import { getParam } from "../utils/params";
import { sendEmail } from "../lib/email/send";
import { approvedTemplate } from "../lib/email/templates/businessApproved";
import { rejectedTemplate } from "../lib/email/templates/businessRejected";
import { suspendedTemplate } from "../lib/email/templates/businessSuspended";
import { notifyBusinessOwner } from "../lib/notifications";
import type {
  FeatureBusinessInput,
  ListBusinessesQuery,
  ModerationReasonInput,
} from "../validation/admin.schemas";
import { writeAuditLog } from "../lib/audit";

const REVIEW_INCLUDE = {
  owner: { select: { id: true, email: true } },
  category: true,
  photos: { orderBy: { order: "asc" as const } },
  serviceItems: true,
};

// Fetches the business owner and sends a template email. Runs AFTER the DB
// update commits. sendEmail never throws, so a failed email can never break
// the admin action itself.
async function notifyOwner(
  business: { ownerId: string; id: string; name: string },
  template: { subject: string; html: string; text: string }
): Promise<void> {
  try {
    const owner = await prisma.user.findUnique({
      where: { id: business.ownerId },
      select: { email: true },
    });
    if (!owner) return;
    await sendEmail({ to: owner.email, ...template });
  } catch (err) {
    console.error("[nookly:email] could not notify business owner:", err);
  }
}

async function list(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { status, page, limit } = res.locals.validatedQuery as ListBusinessesQuery;

    const where = { status };
    const [data, total] = await prisma.$transaction([
      prisma.business.findMany({
        where,
        include: REVIEW_INCLUDE,
        orderBy: { createdAt: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.business.count({ where }),
    ]);

    res.status(200).json({ data, total, page, limit });
  } catch (err) {
    next(err);
  }
}

async function approve(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const business = await prisma.business.findUnique({
      where: { id: getParam(req, "id") },
      include: { owner: { select: { kycStatus: true } } },
    });
    if (!business) {
      throw new HttpError(404, "Business not found");
    }
    if (business.status === BusinessStatus.APPROVED) {
      throw new HttpError(400, "Business is already approved");
    }

    // KYC enforcement point: a business cannot go live unless its OWNER is
    // KYC-verified. KYC is verified once per owner (per User), so a verified
    // owner can list multiple businesses without re-submitting documents.
    if (business.owner.kycStatus !== "VERIFIED") {
      throw new HttpError(
        400,
        "Owner must complete KYC verification before their business can be approved"
      );
    }

    const updated = await prisma.business.update({
      where: { id: business.id },
      data: { status: BusinessStatus.APPROVED },
    });

    writeAuditLog({
      actorId: req.user!.id,
      actorRole: req.user!.role,
      action: "approve",
      targetType: "business",
      targetId: business.id,
    });
    await notifyOwner(
      { ownerId: business.ownerId, id: business.id, name: business.name },
      approvedTemplate({
        businessName: business.name,
        businessId: business.id,
      })
    );
    await notifyBusinessOwner({
      ownerId: business.ownerId,
      type: "BUSINESS_APPROVED",
      businessName: business.name,
      businessId: business.id,
    });
    res.status(200).json({ business: updated });
  } catch (err) {
    next(err);
  }
}

async function reject(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { reason } = req.body as ModerationReasonInput;
    const business = await prisma.business.findUnique({
      where: { id: getParam(req, "id") },
    });
    if (!business) {
      throw new HttpError(404, "Business not found");
    }

    const updated = await prisma.business.update({
      where: { id: business.id },
      data: { status: BusinessStatus.REJECTED, moderationNote: reason },
    });

    writeAuditLog({
      actorId: req.user!.id,
      actorRole: req.user!.role,
      action: "reject",
      targetType: "business",
      targetId: business.id,
      metadata: { reason },
    });
    await notifyOwner(
      { ownerId: business.ownerId, id: business.id, name: business.name },
      rejectedTemplate({
        businessName: business.name,
        reason,
      })
    );
    await notifyBusinessOwner({
      ownerId: business.ownerId,
      type: "BUSINESS_REJECTED",
      businessName: business.name,
      businessId: business.id,
      reason,
    });
    res.status(200).json({ business: updated });
  } catch (err) {
    next(err);
  }
}

async function suspend(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { reason } = req.body as ModerationReasonInput;
    const business = await prisma.business.findUnique({
      where: { id: getParam(req, "id") },
    });
    if (!business) {
      throw new HttpError(404, "Business not found");
    }
    // Only businesses that are currently live can be suspended. Something
    // that was never APPROVED is not public and needs no suspension.
    if (business.status !== BusinessStatus.APPROVED) {
      throw new HttpError(400, "Only approved businesses can be suspended");
    }

    const updated = await prisma.business.update({
      where: { id: business.id },
      data: { status: BusinessStatus.SUSPENDED, moderationNote: reason },
    });

    writeAuditLog({
      actorId: req.user!.id,
      actorRole: req.user!.role,
      action: "suspend",
      targetType: "business",
      targetId: business.id,
      metadata: { reason },
    });
    await notifyOwner(
      { ownerId: business.ownerId, id: business.id, name: business.name },
      suspendedTemplate({
        businessName: business.name,
        reason,
      })
    );
    await notifyBusinessOwner({
      ownerId: business.ownerId,
      type: "BUSINESS_SUSPENDED",
      businessName: business.name,
      businessId: business.id,
      reason,
    });
    res.status(200).json({ business: updated });
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
    const business = await prisma.business.findUnique({
      where: { id: getParam(req, "id") },
      include: REVIEW_INCLUDE,
    });
    if (!business) {
      throw new HttpError(404, "Business not found");
    }

    res.status(200).json({ business });
  } catch (err) {
    next(err);
  }
}

// Manually grant featured/promoted status (the hook for a paid upgrade flow
// later; no payment integration in the MVP). Only APPROVED businesses can be
// featured — there's no point promoting something not publicly visible.
async function feature(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { durationDays } = req.body as FeatureBusinessInput;
    const business = await prisma.business.findUnique({
      where: { id: getParam(req, "id") },
    });
    if (!business) {
      throw new HttpError(404, "Business not found");
    }
    if (business.status !== BusinessStatus.APPROVED) {
      throw new HttpError(400, "Only approved businesses can be featured");
    }

    // durationDays omitted => indefinite (featuredUntil = null).
    const featuredUntil = durationDays
      ? new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000)
      : null;

    const updated = await prisma.business.update({
      where: { id: business.id },
      data: { isFeatured: true, featuredUntil },
    });

    writeAuditLog({
      actorId: req.user!.id,
      actorRole: req.user!.role,
      action: "feature",
      targetType: "business",
      targetId: business.id,
      metadata: durationDays ? { durationDays } : { indefinite: true },
    });
    res.status(200).json({ business: updated });
  } catch (err) {
    next(err);
  }
}

// Revoke featured status. Idempotent: unfeaturing something already
// unfeatured is not an error.
async function unfeature(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const business = await prisma.business.findUnique({
      where: { id: getParam(req, "id") },
    });
    if (!business) {
      throw new HttpError(404, "Business not found");
    }

    const updated = await prisma.business.update({
      where: { id: business.id },
      data: { isFeatured: false, featuredUntil: null },
    });

    writeAuditLog({
      actorId: req.user!.id,
      actorRole: req.user!.role,
      action: "unfeature",
      targetType: "business",
      targetId: business.id,
    });
    res.status(200).json({ business: updated });
  } catch (err) {
    next(err);
  }
}

export const adminController = { list, approve, reject, suspend, getOne, feature, unfeature };
