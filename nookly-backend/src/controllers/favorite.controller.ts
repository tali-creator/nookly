import type { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import prisma from "../models/prisma";
import { HttpError } from "../utils/http-error";
import type { FavoriteBodyInput } from "../validation/favorite.schemas";

// Lightweight business shape (mirrors /businesses/nearby items, minus
// distance) so list views can render without a second request.
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
  photos: { url: string }[];
  serviceItems: { price: unknown }[];
  hours: { dayOfWeek: number; openTime: string | null; closeTime: string | null; isClosed: boolean }[];
  owner: { displayName: string | null; kycStatus: string };
  isFeatured: boolean;
}) {
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
    isFeatured: business.isFeatured,
    price: business.serviceItems[0]?.price ?? null,
    owner: {
      name: business.owner.displayName,
      isVerified: business.owner.kycStatus === "VERIFIED",
    },
    hours: business.hours,
  };
}

async function add(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { deviceId, businessId } = req.body as FavoriteBodyInput;

    // Same "don't leak pending listings" rule as the public business route:
    // only APPROVED businesses can be favorited.
    const business = await prisma.business.findFirst({
      where: { id: businessId, status: "APPROVED" },
      select: { id: true },
    });
    if (!business) {
      throw new HttpError(400, "Business not found or not approved");
    }

    const existing = await prisma.favorite.findUnique({
      where: { deviceId_businessId: { deviceId, businessId } },
    });
    if (existing) {
      // Idempotent: favoriting twice is not an error.
      res.status(200).json({ favorite: existing });
      return;
    }

    try {
      const favorite = await prisma.favorite.create({
        data: { deviceId, businessId },
      });
      res.status(201).json({ favorite });
    } catch (err) {
      // Unique (deviceId, businessId) violation from a concurrent request.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        const favorite = await prisma.favorite.findUnique({
          where: { deviceId_businessId: { deviceId, businessId } },
        });
        res.status(200).json({ favorite });
        return;
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
}

async function remove(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { deviceId, businessId } = req.body as FavoriteBodyInput;

    // Idempotent: deleting a non-existent favorite is not an error.
    await prisma.favorite.deleteMany({ where: { deviceId, businessId } });

    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

async function list(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { deviceId } = res.locals.validatedQuery as { deviceId: string };

    const favorites = await prisma.favorite.findMany({
      where: { deviceId },
      include: {
        business: {
          include: {
            category: true,
            photos: { take: 1, orderBy: { order: "asc" } },
            hours: { orderBy: { dayOfWeek: "asc" } },
            owner: { select: { displayName: true, kycStatus: true } },
            serviceItems: { orderBy: { price: "asc" }, take: 1 },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // A favorited business that is no longer APPROVED (suspended/rejected)
    // is silently excluded rather than erroring.
    const data = favorites
      .filter((f) => f.business.status === "APPROVED")
      .map((f) => ({
        ...toListItem(f.business),
        favoritedAt: f.createdAt,
      }));

    res.status(200).json({ favorites: data });
  } catch (err) {
    next(err);
  }
}

async function check(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { deviceId, businessId } = res.locals.validatedQuery as {
      deviceId: string;
      businessId: string;
    };

    const favorite = await prisma.favorite.findUnique({
      where: { deviceId_businessId: { deviceId, businessId } },
      select: { id: true },
    });

    res.status(200).json({ favorited: favorite !== null });
  } catch (err) {
    next(err);
  }
}

export const favoriteController = { add, remove, list, check };