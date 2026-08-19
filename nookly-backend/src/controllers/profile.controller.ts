import type { NextFunction, Request, Response } from "express";
import prisma from "../models/prisma";
import { HttpError } from "../utils/http-error";
import { deleteFileByUrl, toPublicUrl } from "../utils/storage";
import type { UpdateProfileInput } from "../validation/profile.schemas";

// Owner-facing profile shape. Social handles are stored as free-form JSON but
// only known keys are accepted at the API boundary (see profile.schemas.ts).
// kycStatus is included so the frontend can drive the KYC flow. businesses is
// a lightweight summary (no nested photos/services) for the profile overview.
function profilePayload(user: {
  id: string;
  email: string;
  role: string;
  displayName: string | null;
  bio: string | null;
  preferredContactMethod: string | null;
  phone: string | null;
  whatsappNumber: string | null;
  socialHandles: unknown;
  avatarUrl: string | null;
  kycStatus: string;
  createdAt: Date;
  businesses: Array<{
    id: string;
    name: string;
    status: string;
    isFeatured: boolean;
    moderationNote: string | null;
  }>;
}) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    displayName: user.displayName,
    bio: user.bio,
    preferredContactMethod: user.preferredContactMethod,
    phone: user.phone,
    whatsappNumber: user.whatsappNumber,
    socialHandles: user.socialHandles ?? null,
    avatarUrl: user.avatarUrl,
    kycStatus: user.kycStatus,
    createdAt: user.createdAt.toISOString(),
    businesses: user.businesses,
  };
}

async function getProfile(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        role: true,
        displayName: true,
        bio: true,
        preferredContactMethod: true,
        phone: true,
        whatsappNumber: true,
        socialHandles: true,
        avatarUrl: true,
        kycStatus: true,
        createdAt: true,
        businesses: {
          select: { id: true, name: true, status: true, isFeatured: true, moderationNote: true },
          orderBy: { createdAt: "desc" },
        },
      },
    });
    if (!user) {
      throw new HttpError(401, "Invalid or expired token");
    }
    res.status(200).json({ profile: profilePayload(user) });
  } catch (err) {
    next(err);
  }
}

async function updateProfile(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const body = req.body as UpdateProfileInput;

    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        ...(body.displayName !== undefined && { displayName: body.displayName }),
        ...(body.bio !== undefined && { bio: body.bio }),
        ...(body.preferredContactMethod !== undefined && { preferredContactMethod: body.preferredContactMethod }),
        ...(body.phone !== undefined && { phone: body.phone }),
        ...(body.whatsappNumber !== undefined && { whatsappNumber: body.whatsappNumber }),
        ...(body.socialHandles !== undefined && { socialHandles: body.socialHandles }),
      },
      select: {
        id: true,
        email: true,
        role: true,
        displayName: true,
        bio: true,
        preferredContactMethod: true,
        phone: true,
        whatsappNumber: true,
        socialHandles: true,
        avatarUrl: true,
        kycStatus: true,
        createdAt: true,
        businesses: {
          select: { id: true, name: true, status: true, isFeatured: true, moderationNote: true },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    res.status(200).json({ profile: profilePayload(user) });
  } catch (err) {
    next(err);
  }
}

// Multipart upload; avatarUpload middleware enforces image-only + 2MB. Replaces
// the existing avatar (old file deleted from disk) so stale files don't linger.
async function uploadAvatar(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const file = req.file;
    if (!file) {
      throw new HttpError(400, "No image file provided");
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { avatarUrl: true },
    });

    const avatarUrl = toPublicUrl(file.filename);
    await prisma.user.update({
      where: { id: req.user!.id },
      data: { avatarUrl },
    });

    // Remove the previous avatar file only after the new one is committed.
    if (user?.avatarUrl) {
      deleteFileByUrl(user.avatarUrl);
    }

    res.status(201).json({ avatarUrl });
  } catch (err) {
    next(err);
  }
}

export const profileController = { getProfile, updateProfile, uploadAvatar };