import type { NextFunction, Request, Response } from "express";
import prisma from "../models/prisma";
import { HttpError } from "../utils/http-error";
import { getParam } from "../utils/params";
import type { RecordVisitBodyInput } from "../validation/owner.schemas";

// Public business list shape — mirrors /businesses/nearby items so the shared
// frontend card component (renderBusinessCard) can render them directly.
function toListItem(business: {
  id: string;
  name: string;
  categoryId: string;
  category: { id: string; name: string };
  description: string;
  address: string;
  lat: number;
  lng: number;
  phone: string;
  whatsappNumber: string | null;
  timezone: string;
  isFeatured: boolean;
  featuredUntil: Date | null;
  photos: { url: string }[];
  hours: {
    dayOfWeek: number;
    openTime: string | null;
    closeTime: string | null;
    isClosed: boolean;
  }[];
  serviceItems: { price: unknown }[];
}) {
  const featured =
    business.isFeatured &&
    (business.featuredUntil === null || business.featuredUntil > new Date());

  return {
    id: business.id,
    name: business.name,
    category: business.category,
    description: business.description,
    address: business.address,
    lat: business.lat,
    lng: business.lng,
    phone: business.phone,
    whatsappNumber: business.whatsappNumber,
    timezone: business.timezone,
    coverUrl: business.photos[0]?.url ?? null,
    isFeatured: featured,
    hours: business.hours,
    price: business.serviceItems[0]?.price ?? null,
  };
}

function joinedLabel(createdAt: Date): string {
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  return "Joined " + months[createdAt.getMonth()] + " " + createdAt.getFullYear();
}

// Public owner profile + all their live (APPROVED) businesses. No auth: any
// visitor can view an owner. Pending/rejected/suspended listings are excluded,
// and archived (soft-deleted) owners are hidden entirely.
async function getPublicOwner(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const owner = await prisma.user.findFirst({
      where: { id: getParam(req, "id"), deletedAt: null },
      select: {
        id: true,
        displayName: true,
        bio: true,
        avatarUrl: true,
        phone: true,
        whatsappNumber: true,
        kycStatus: true,
        createdAt: true,
      },
    });

    if (!owner) {
      throw new HttpError(404, "Owner not found");
    }

    const businesses = await prisma.business.findMany({
      where: { ownerId: owner.id, status: "APPROVED" },
      include: {
        category: true,
        photos: { take: 1, orderBy: { order: "asc" } },
        hours: { orderBy: { dayOfWeek: "asc" } },
        serviceItems: { orderBy: { price: "asc" }, take: 1 },
      },
      orderBy: { updatedAt: "desc" },
    });

    const isVerified = owner.kycStatus === "VERIFIED";

    res.status(200).json({
      owner: {
        id: owner.id,
        name: owner.displayName,
        bio: owner.bio,
        avatarUrl: owner.avatarUrl,
        phone: owner.phone,
        whatsappNumber: owner.whatsappNumber,
        kycStatus: owner.kycStatus,
        isVerified,
        joinedLabel: joinedLabel(owner.createdAt),
      },
      businesses: businesses.map(toListItem),
    });
  } catch (err) {
    next(err);
  }
}

// Anonymous owner-profile visit. Mirrors AnalyticsEvent.track: acknowledge
// immediately, persist in the background so the page render isn't blocked.
// Requires the owner to exist and not be archived.
async function recordVisit(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { deviceId } = req.body as RecordVisitBodyInput;

    const owner = await prisma.user.findFirst({
      where: { id: getParam(req, "id"), deletedAt: null },
      select: { id: true },
    });
    if (!owner) {
      throw new HttpError(404, "Owner not found");
    }

    res.status(202).json({ status: "accepted" });

    prisma.ownerVisit
      .create({ data: { ownerId: owner.id, deviceId: deviceId ?? null } })
      .catch((err) => {
        console.error("[nookly:owner-visits] failed to persist visit", err);
      });
  } catch (err) {
    next(err);
  }
}

// Owner-only: total visitors to the authenticated owner's public profile.
async function getMyVisitors(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const visitors = await prisma.ownerVisit.count({
      where: { ownerId: req.user!.id },
    });
    res.status(200).json({ visitors });
  } catch (err) {
    next(err);
  }
}

export const ownerController = { getPublicOwner, recordVisit, getMyVisitors };