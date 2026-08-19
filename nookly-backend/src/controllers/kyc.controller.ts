import type { NextFunction, Request, Response } from "express";
import fs from "fs";
import { KycSubmissionStatus, ProofOfAddressType } from "@prisma/client";
import prisma from "../models/prisma";
import { HttpError } from "../utils/http-error";
import { getParam } from "../utils/params";
import { maskSensitive } from "../utils/mask";
import { deletePrivateFile, privateFilePath, toPrivateUrl } from "../utils/storage";
import { encryptSecret } from "../utils/encryption";
import type { KycSubmissionBodyInput } from "../validation/kyc.schemas";

// Maps the document route/upload field name to the DB column storing the
// private pseudo-URL. Used by both the upload cross-field validation and the
// document-streaming routes.
export const DOCUMENT_FIELD_URLS = {
  selfie: "selfieUrl",
  certificate: "certificateUrl",
  proofOfAddressHome: "proofOfAddressHomeUrl",
  proofOfAddressWorkshop: "proofOfAddressWorkshopUrl",
} as const;

export type KycDocumentField = keyof typeof DOCUMENT_FIELD_URLS;

export function isDocumentField(value: string): value is KycDocumentField {
  return value in DOCUMENT_FIELD_URLS;
}

// Which proof-of-address files are required for a given proofOfAddressType.
const REQUIRED_PROOF_FILES: Record<ProofOfAddressType, KycDocumentField[]> = {
  [ProofOfAddressType.HOME]: ["proofOfAddressHome"],
  [ProofOfAddressType.WORKSHOP]: ["proofOfAddressWorkshop"],
  [ProofOfAddressType.BOTH]: ["proofOfAddressHome", "proofOfAddressWorkshop"],
};

// Owner-facing submission shape. NIN is ALWAYS masked — the raw value never
// leaves the API (the nin column itself is encrypted at rest; the masked form
// is precomputed at write time and stored in ninMasked, so reads never need
// to decrypt). No document URLs are returned here; they are streamed via the
// dedicated authenticated document routes.
function submissionPayload(submission: {
  status: string;
  ninMasked: string;
  proofOfAddressType: string;
  rejectionReason: string | null;
  submittedAt: Date;
  reviewedAt: Date | null;
}) {
  return {
    status: submission.status,
    ninMasked: submission.ninMasked,
    proofOfAddressType: submission.proofOfAddressType,
    rejectionReason: submission.rejectionReason,
    submittedAt: submission.submittedAt,
    reviewedAt: submission.reviewedAt,
  };
}

async function submit(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const body = req.body as KycSubmissionBodyInput;
    const files = (req.files ?? {}) as Record<string, Express.Multer.File[]>;
    const userId = req.user!.id;

    const selfie = files["selfie"]?.[0];
    if (!selfie) {
      throw new HttpError(400, "A selfie photo is required");
    }

    // Cross-field validation: proofOfAddressType determines which proof files
    // are required. Anything uploaded beyond the required set is also cleaned
    // up here so a rejected request never leaves orphaned files.
    const required = REQUIRED_PROOF_FILES[body.proofOfAddressType];
    const optionalFiles = Object.entries(files).filter(([field]) => field !== "selfie");
    const uploadedFields = optionalFiles.map(([field]) => field);

    for (const field of required) {
      if (!files[field]?.[0]) {
        // Clean up everything this request already wrote to disk.
        optionalFiles.forEach(([, list]) => list.forEach((f) => fs.unlink(f.path, () => {})));
        throw new HttpError(
          400,
          body.proofOfAddressType === "BOTH"
            ? "proofOfAddressType BOTH requires both proof of address files"
            : `proofOfAddressType ${body.proofOfAddressType} requires the ${field} file`
        );
      }
    }

    // Build the URL set from actually-uploaded files. Fields not uploaded this
    // time are null — the submission is replaced wholesale.
    const urlFor = (field: string): string | undefined =>
      files[field]?.[0] ? toPrivateUrl(files[field][0].filename) : undefined;

    const newUrls = {
      selfieUrl: toPrivateUrl(selfie.filename),
      certificateUrl: urlFor("certificate") ?? null,
      proofOfAddressHomeUrl: urlFor("proofOfAddressHome") ?? null,
      proofOfAddressWorkshopUrl: urlFor("proofOfAddressWorkshop") ?? null,
    };

    const previous = await prisma.kycSubmission.findUnique({
      where: { userId },
      select: {
        selfieUrl: true,
        certificateUrl: true,
        proofOfAddressHomeUrl: true,
        proofOfAddressWorkshopUrl: true,
      },
    });

    // NIN is encrypted at rest. The masked display value is precomputed here
    // and stored alongside so API reads (owner + admin) never decrypt.
    const ninCiphertext = encryptSecret(body.nin);
    const ninMasked = maskSensitive(body.nin) ?? "";

    // Upsert on userId: one submission record per user, overwritten on each
    // resubmission. Status resets to PENDING and any prior rejection is cleared.
    const submission = await prisma.kycSubmission.upsert({
      where: { userId },
      update: {
        ...newUrls,
        nin: ninCiphertext,
        ninMasked,
        proofOfAddressType: body.proofOfAddressType,
        status: KycSubmissionStatus.PENDING,
        rejectionReason: null,
        submittedAt: new Date(),
        reviewedAt: null,
        reviewedByAdminId: null,
      },
      create: {
        userId,
        nin: ninCiphertext,
        ninMasked,
        proofOfAddressType: body.proofOfAddressType,
        ...newUrls,
      },
    });

    await prisma.user.update({
      where: { id: userId },
      data: { kycStatus: "PENDING" },
    });

    // Delete old private files that are no longer referenced by the new
    // submission (replaced fields and fields the new type no longer uses).
    if (previous) {
      const oldUrls = [
        { key: "selfieUrl", v: previous.selfieUrl },
        { key: "certificateUrl", v: previous.certificateUrl },
        { key: "proofOfAddressHomeUrl", v: previous.proofOfAddressHomeUrl },
        { key: "proofOfAddressWorkshopUrl", v: previous.proofOfAddressWorkshopUrl },
      ];
      for (const { key, v } of oldUrls) {
        if (v && newUrls[key as keyof typeof newUrls] !== v) {
          deletePrivateFile(v);
        }
      }
    }

    res.status(201).json({ submission: submissionPayload(submission) });
  } catch (err) {
    next(err);
  }
}

async function getMyKyc(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const submission = await prisma.kycSubmission.findUnique({
      where: { userId: req.user!.id },
      select: {
        status: true,
        ninMasked: true,
        proofOfAddressType: true,
        rejectionReason: true,
        submittedAt: true,
        reviewedAt: true,
      },
    });

    if (!submission) {
      res.status(200).json({ submission: null });
      return;
    }

    res.status(200).json({ submission: submissionPayload(submission) });
  } catch (err) {
    next(err);
  }
}

// Streams one of the caller's own KYC documents. Own-document-only: the URL is
// resolved from the requesting user's submission, never from a client-provided
// path. Returns the raw file (image) with its content type — never a static URL.
async function getMyDocument(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const field = getParam(req, "field");
    if (!isDocumentField(field)) {
      throw new HttpError(400, "Invalid document field");
    }

    const submission = await prisma.kycSubmission.findUnique({
      where: { userId: req.user!.id },
      select: { [DOCUMENT_FIELD_URLS[field]]: true },
    });
    const url: string | null = submission?.[DOCUMENT_FIELD_URLS[field]] ?? null;
    if (!url) {
      throw new HttpError(404, "Document not found");
    }

    const filePath = privateFilePath(url);
    if (!fs.existsSync(filePath)) {
      throw new HttpError(404, "Document not found");
    }

    res.type(pathToContentType(filePath));
    res.sendFile(filePath);
  } catch (err) {
    next(err);
  }
}

// Minimal extension -> mime map for the files we accept (jpeg/png/webp).
function pathToContentType(filePath: string): string {
  const ext = filePath.slice(filePath.lastIndexOf(".")).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return "image/jpeg";
}

export const kycController = { submit, getMyKyc, getMyDocument };