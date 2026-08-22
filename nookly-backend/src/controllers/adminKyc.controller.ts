import type { NextFunction, Request, Response } from "express";
import { KycSubmissionStatus } from "@prisma/client";
import prisma from "../models/prisma";
import { HttpError } from "../utils/http-error";
import { getParam } from "../utils/params";
import { privateFilePath, streamPrivateObject } from "../utils/storage";
import { sendEmail } from "../lib/email/send";
import { kycVerifiedTemplate } from "../lib/email/templates/kycVerified";
import { kycRejectedTemplate } from "../lib/email/templates/kycRejected";
import { notifyKycUser } from "../lib/notifications";
import type { ListKycQuery } from "../validation/kyc.schemas";
import type { ModerationReasonInput } from "../validation/admin.schemas";
import { writeAuditLog } from "../lib/audit";
import {
  DOCUMENT_FIELD_URLS,
  isDocumentField,
} from "./kyc.controller";

const QUEUE_SELECT = {
  id: true,
  status: true,
  ninMasked: true,
  submittedAt: true,
  reviewedAt: true,
  user: {
    select: { id: true, email: true, displayName: true },
  },
} as const;

// Full detail. The NIN stays MASKED in this response too: admins review the
// actual document images through the document-streaming route rather than the
// raw number, to limit exposure of the plaintext NIN in logs/responses. (If a
// future admin workflow genuinely needs the unmasked NIN to do the job,
// expose it only here — the single detail endpoint — never in list views.)
const DETAIL_SELECT = {
  id: true,
  ninMasked: true,
  status: true,
  proofOfAddressType: true,
  rejectionReason: true,
  submittedAt: true,
  reviewedAt: true,
  reviewedByAdmin: { select: { id: true, email: true } },
  user: {
    select: { id: true, email: true, displayName: true, kycStatus: true },
  },
} as const;

async function notifyOwner(
  user: { id: string; email: string },
  template: { subject: string; html: string; text: string }
): Promise<void> {
  try {
    await sendEmail({ to: user.email, ...template });
  } catch (err) {
    console.error("[nookly:email] could not notify owner:", err);
  }
}

async function list(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { status, page, limit } = res.locals.validatedQuery as ListKycQuery;

    const where = { status };
    const [submissions, total] = await prisma.$transaction([
      prisma.kycSubmission.findMany({
        where,
        select: QUEUE_SELECT,
        orderBy: { submittedAt: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.kycSubmission.count({ where }),
    ]);

    const data = submissions.map((s) => ({
      id: s.id,
      status: s.status,
      ninMasked: s.ninMasked,
      submittedAt: s.submittedAt,
      reviewedAt: s.reviewedAt,
      owner: s.user,
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
    const submission = await prisma.kycSubmission.findUnique({
      where: { userId: getParam(req, "userId") },
      select: DETAIL_SELECT,
    });
    if (!submission) {
      throw new HttpError(404, "KYC submission not found");
    }

    res.status(200).json({ submission });
  } catch (err) {
    next(err);
  }
}

async function verify(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = getParam(req, "userId");
    const submission = await prisma.kycSubmission.findUnique({
      where: { userId },
      select: { id: true, status: true, user: { select: { id: true, email: true } } },
    });
    if (!submission) {
      throw new HttpError(404, "KYC submission not found");
    }
    if (submission.status === KycSubmissionStatus.VERIFIED) {
      throw new HttpError(400, "Submission is already verified");
    }

    const updated = await prisma.kycSubmission.update({
      where: { id: submission.id },
      data: {
        status: KycSubmissionStatus.VERIFIED,
        reviewedAt: new Date(),
        reviewedByAdminId: req.user!.id,
        rejectionReason: null,
      },
    });
    await prisma.user.update({
      where: { id: userId },
      data: { kycStatus: "VERIFIED" },
    });

    // Product decision: KYC verification is the one-time human review. Once
    // the owner is verified, all their businesses go live immediately — no
    // per-business admin approval needed.
    await prisma.business.updateMany({
      where: { ownerId: userId, status: "PENDING" },
      data: { status: "APPROVED" },
    });

    writeAuditLog({
      actorId: req.user!.id,
      actorRole: req.user!.role,
      action: "kyc_verify",
      targetType: "user",
      targetId: userId,
    });
    await notifyOwner(submission.user, kycVerifiedTemplate({}));
    await notifyKycUser({ userId, type: "KYC_VERIFIED" });

    res.status(200).json({
      submission: {
        id: updated.id,
        status: updated.status,
        reviewedAt: updated.reviewedAt,
        reviewedByAdminId: updated.reviewedByAdminId,
      },
    });
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
    const userId = getParam(req, "userId");
    const submission = await prisma.kycSubmission.findUnique({
      where: { userId },
      select: { id: true, status: true, user: { select: { id: true, email: true } } },
    });
    if (!submission) {
      throw new HttpError(404, "KYC submission not found");
    }

    const updated = await prisma.kycSubmission.update({
      where: { id: submission.id },
      data: {
        status: KycSubmissionStatus.REJECTED,
        rejectionReason: reason,
        reviewedAt: new Date(),
        reviewedByAdminId: req.user!.id,
      },
    });
    await prisma.user.update({
      where: { id: userId },
      data: { kycStatus: "REJECTED" },
    });

    writeAuditLog({
      actorId: req.user!.id,
      actorRole: req.user!.role,
      action: "kyc_reject",
      targetType: "user",
      targetId: userId,
      metadata: { reason },
    });
    await notifyOwner(submission.user, kycRejectedTemplate({ reason }));
    await notifyKycUser({ userId, type: "KYC_REJECTED", reason });

    res.status(200).json({
      submission: {
        id: updated.id,
        status: updated.status,
        rejectionReason: updated.rejectionReason,
        reviewedAt: updated.reviewedAt,
      },
    });
  } catch (err) {
    next(err);
  }
}

// Streams a specific user's KYC document for admin review. Verifies the
// submission belongs to the :userId param — never trusts a client path.
async function getDocument(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = getParam(req, "userId");
    const field = getParam(req, "field");
    if (!isDocumentField(field)) {
      throw new HttpError(400, "Invalid document field");
    }

    const submission = await prisma.kycSubmission.findUnique({
      where: { userId },
      select: { [DOCUMENT_FIELD_URLS[field]]: true },
    });
    const url: string | null = submission?.[DOCUMENT_FIELD_URLS[field]] ?? null;
    if (!url) {
      throw new HttpError(404, "Document not found");
    }

    const key = privateFilePath(url);
    await streamPrivateObject(key, res);
  } catch (err) {
    next(err);
  }
}

export const adminKycController = { list, getOne, verify, reject, getDocument };