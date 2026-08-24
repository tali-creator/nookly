import type { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import prisma from "../models/prisma";
import { HttpError } from "../utils/http-error";
import { getParam } from "../utils/params";
import { deleteFileByUrl } from "../utils/storage";
import type { CreateBusinessInput, UpdateBusinessInput } from "../validation/business.schemas";
import type { BusinessHoursInput } from "../validation/hours.schemas";
import type { NearbySearchQuery, FeaturedListQuery } from "../validation/search.schemas";

const PHOTOS_INCLUDE = {
  photos: { orderBy: { order: "asc" as const } },
};

const HOURS_INCLUDE = {
  hours: { orderBy: { dayOfWeek: "asc" as const } },
};

const EARTH_RADIUS_KM = 6371;
const KM_PER_DEGREE_LAT = 111.32;

async function create(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const body = req.body as CreateBusinessInput;
    const ownerId = req.user!.id;

    const category = await prisma.category.findUnique({
      where: { id: body.categoryId },
    });
    if (!category) {
      throw new HttpError(400, "Invalid category");
    }

    // Product decision: a verified owner's business goes live immediately —
    // KYC verification is the one-time human review, and per-business admin
    // approval was removed. Unverified owners still get PENDING so a human
    // can review before anything appears publicly.
    const owner = await prisma.user.findUnique({
      where: { id: ownerId },
      select: { kycStatus: true },
    });
    const status = owner?.kycStatus === "VERIFIED" ? "APPROVED" : "PENDING";

    const business = await prisma.business.create({
      data: {
        ownerId,
        name: body.name,
        categoryId: body.categoryId,
        description: body.description,
        address: body.address,
        lat: body.lat,
        lng: body.lng,
        phone: body.phone,
        whatsappNumber: body.whatsappNumber ?? null,
        status,
      },
    });

    res.status(201).json({ business });
  } catch (err) {
    next(err);
  }
}

async function mine(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const businesses = await prisma.business.findMany({
      where: { ownerId: req.user!.id },
      include: {
        serviceItems: true,
        category: true,
        photos: { orderBy: { order: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({ businesses });
  } catch (err) {
    next(err);
  }
}

// Public single-business view: only APPROVED businesses are ever returned.
// Pending/rejected/suspended listings look identical to non-existent ones.
async function getPublicById(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const business = await prisma.business.findFirst({
      where: { id: getParam(req, "id"), status: "APPROVED" },
      include: {
        category: true,
        serviceItems: true,
        photos: { orderBy: { order: "asc" } },
        hours: { orderBy: { dayOfWeek: "asc" } },
      },
    });

    if (!business) {
      throw new HttpError(404, "Business not found");
    }

    // Computed live "featured" status (overrides the raw isFeatured column in
    // the response so consumers only ever see the effective value):
    // isFeatured AND (featuredUntil IS NULL OR featuredUntil > now).
    const isFeatured =
      business.isFeatured &&
      (business.featuredUntil === null || business.featuredUntil > new Date());

    res.status(200).json({ business: { ...business, isFeatured } });
  } catch (err) {
    next(err);
  }
}

// Public nearby search.
// Strategy:
//  1. Only APPROVED businesses.
//  2. Pre-filter with an indexed bounding box (lat/lng BETWEEN) using an
//     approximate degree offset for the radius, so Postgres can use the
//     @@index([lat, lng]) before doing exact math.
//  3. Exact Haversine distance computed in raw SQL (parameterized via
//     Prisma.sql, never string concatenation) and filtered to <= radius,
//     ordered closest first.
//  4. category and q (ILIKE name OR description) filters applied in the same
//     query before pagination.
//  5. Returns light payload: core fields + category name + cover photo url +
//     timezone + full-week hours + distanceKm + computed isFeatured. Full
//     detail lives on GET /businesses/:id.
//  6. openNow=true filters to businesses currently open, evaluated in EACH
//     business's own timezone (now() AT TIME ZONE b.timezone). Businesses
//     with no BusinessHours rows are excluded (unknown == closed).
//     NOTE: overnight hours crossing midnight are not handled yet
//     (closeTime > openTime is always assumed).
//  7. Featured businesses (computed at query time) within the radius sort
//     first (distance tie-break), then everyone else by distance. Featured
//     never overrides the radius filter.
interface NearbyRow {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  description: string;
  address: string;
  lat: number;
  lng: number;
  phone: string;
  whatsappNumber: string | null;
  timezone: string;
  coverUrl: string | null;
  distanceKm: string; // numeric/decimal comes back as string from $queryRaw
  isFeatured: boolean;
  ownerName: string | null;
  ownerVerified: boolean;
  ownerId: string;
  price: string | null; // cheapest service price, Decimal -> string from SQL
}

async function nearby(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { lat, lng, radius, category, q, page, limit, openNow } =
      res.locals.validatedQuery as NearbySearchQuery;

    if (category) {
      const cat = await prisma.category.findUnique({ where: { id: category } });
      if (!cat) {
        throw new HttpError(400, "Invalid category");
      }
    }

    // Bounding box in degrees. Latitude is ~111.32 km/deg; longitude shrinks
    // by cos(lat). Clamp cos to avoid a degenerate box near the poles.
    const latDelta = radius / KM_PER_DEGREE_LAT;
    const cosLat = Math.max(Math.cos((lat * Math.PI) / 180), 0.01);
    const lngDelta = Math.min(radius / (KM_PER_DEGREE_LAT * cosLat), 180);
    const latMin = lat - latDelta;
    const latMax = lat + latDelta;
    const lngMin = lng - lngDelta;
    const lngMax = lng + lngDelta;

    const conditions: Prisma.Sql[] = [
      Prisma.sql`b.status = 'APPROVED'`,
      Prisma.sql`b.lat BETWEEN ${latMin} AND ${latMax}`,
      Prisma.sql`b.lng BETWEEN ${lngMin} AND ${lngMax}`,
    ];
    if (category) {
      conditions.push(Prisma.sql`b."categoryId" = ${category}`);
    }
    if (q) {
      // Escape LIKE wildcards so user input can't inject % or _ patterns.
      const escaped = q.replace(/[\\%_]/g, (m) => `\\${m}`);
      const pattern = `%${escaped}%`;
      conditions.push(
        Prisma.sql`(b.name ILIKE ${pattern} OR b.description ILIKE ${pattern})`
      );
    }
    if (openNow) {
      // "Now" is evaluated in the business's own timezone. EXTRACT(DOW) uses
      // Postgres convention 0=Sunday..6=Saturday, matching our dayOfWeek.
      // Businesses with no matching open hours row are excluded (unknown).
      conditions.push(
        Prisma.sql`EXISTS (
          SELECT 1 FROM business_hours bh
          WHERE bh."businessId" = b.id
            AND bh."dayOfWeek" = EXTRACT(DOW FROM now() AT TIME ZONE b.timezone)::int
            AND bh."isClosed" = false
            AND bh."openTime" <= TO_CHAR(now() AT TIME ZONE b.timezone, 'HH24:MI')
            AND bh."closeTime" > TO_CHAR(now() AT TIME ZONE b.timezone, 'HH24:MI')
        )`
      );
    }
    const where = Prisma.join(conditions, " AND ");

    const haversine = Prisma.sql`(
      ${EARTH_RADIUS_KM} * acos(
        least(1.0, cos(radians(${lat})) * cos(radians(b.lat)) *
          cos(radians(b.lng) - radians(${lng})) +
          sin(radians(${lat})) * sin(radians(b.lat)))
      )
    )`;

    const base = Prisma.sql`
      SELECT
        b.id, b.name, b."categoryId", b.description, b.address,
        b.lat, b.lng, b.phone, b."whatsappNumber", b.timezone,
        c.name AS "categoryName",
        cover."url" AS "coverUrl",
        u.id AS "ownerId",
        u."displayName" AS "ownerName",
        (u."kycStatus" = 'VERIFIED') AS "ownerVerified",
        -- "Currently featured" is computed at query time so expiry is always
        -- accurate: isFeatured AND (featuredUntil IS NULL OR featuredUntil > now).
        (b."isFeatured" AND (b."featuredUntil" IS NULL OR b."featuredUntil" > now())) AS "isFeatured",
        svc."price" AS "price",
        ROUND(${haversine}::numeric, 1) AS "distanceKm"
      FROM businesses b
      JOIN categories c ON c.id = b."categoryId"
      JOIN users u ON u.id = b."ownerId"
      LEFT JOIN LATERAL (
        SELECT p.url FROM photos p
        WHERE p."businessId" = b.id
        ORDER BY p."order" ASC, p.id ASC
        LIMIT 1
      ) cover ON TRUE
      LEFT JOIN LATERAL (
        -- Cheapest service price for the "From ₦…" hint on cards. ServiceItem
        -- prices are DECIMAL(10,2); NULL when the business lists no services.
        SELECT s.price FROM service_items s
        WHERE s."businessId" = b.id
        ORDER BY s.price ASC
        LIMIT 1
      ) svc ON TRUE
      WHERE ${where}
    `;

    const offset = (page - 1) * limit;

    // Featured businesses within the radius sort first (tie-broken by
    // distance), then everything else by distance. Featured status does NOT
    // override the radius filter: the WHERE on distanceKm still applies.
    const [rows, countRows] = await Promise.all([
      prisma.$queryRaw<NearbyRow[]>(Prisma.sql`
        SELECT * FROM (${base}) AS nearby
        WHERE "distanceKm" <= ${radius}
        ORDER BY "isFeatured" DESC, "distanceKm" ASC
        LIMIT ${limit} OFFSET ${offset}
      `),
      prisma.$queryRaw<{ total: number }[]>(Prisma.sql`
        SELECT COUNT(*)::int AS total FROM (${base}) AS nearby
        WHERE "distanceKm" <= ${radius}
      `),
    ]);

    // Full-week hours for the returned page (max 50 rows), attached so the
    // frontend can render "Open now" without a second request.
    const businessIds = rows.map((row) => row.id);
    const hoursRows = await prisma.businessHours.findMany({
      where: { businessId: { in: businessIds } },
      orderBy: { dayOfWeek: "asc" },
    });
    const hoursByBusiness = new Map<string, typeof hoursRows>();
    for (const h of hoursRows) {
      const list = hoursByBusiness.get(h.businessId) ?? [];
      list.push(h);
      hoursByBusiness.set(h.businessId, list);
    }

    const data = rows.map((row) => ({
      id: row.id,
      name: row.name,
      category: { id: row.categoryId, name: row.categoryName },
      description: row.description,
      address: row.address,
      lat: row.lat,
      lng: row.lng,
      phone: row.phone,
      whatsappNumber: row.whatsappNumber,
      timezone: row.timezone,
      coverUrl: row.coverUrl,
      isFeatured: row.isFeatured,
      distanceKm: Math.round(parseFloat(row.distanceKm) * 10) / 10,
      price: row.price,
      owner: { id: row.ownerId, name: row.ownerName, isVerified: row.ownerVerified },
      hours: hoursByBusiness.get(row.id) ?? [],
    }));

    res.status(200).json({
      data,
      total: countRows[0]?.total ?? 0,
      page,
      limit,
      radius,
    });
  } catch (err) {
    next(err);
  }
}

// Public list of currently-featured APPROVED businesses, no location filter.
// Same lightweight shape as nearby results (minus distance). Order is
// most-recently-featured first — proxied by updatedAt DESC since featuring
// touches updatedAt and the schema deliberately has no featuredAt column.
async function featured(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { limit } = res.locals.validatedQuery as FeaturedListQuery;

    const now = new Date();
    const businesses = await prisma.business.findMany({
      where: {
        status: "APPROVED",
        isFeatured: true,
        OR: [{ featuredUntil: null }, { featuredUntil: { gt: now } }],
      },
      include: {
        category: true,
        owner: { select: { id: true, displayName: true, kycStatus: true } },
        photos: { take: 1, orderBy: { order: "asc" } },
        hours: { orderBy: { dayOfWeek: "asc" } },
        serviceItems: { orderBy: { price: "asc" }, take: 1 },
      },
      orderBy: { updatedAt: "desc" },
      take: limit,
    });

    const data = businesses.map((business) => ({
      id: business.id,
      name: business.name,
      category: { id: business.categoryId, name: business.category.name },
      description: business.description,
      address: business.address,
      lat: business.lat,
      lng: business.lng,
      phone: business.phone,
      whatsappNumber: business.whatsappNumber,
      timezone: business.timezone,
      coverUrl: business.photos[0]?.url ?? null,
      isFeatured: true,
      price: business.serviceItems[0]?.price ?? null,
      owner: {
        id: business.owner.id,
        name: business.owner.displayName,
        isVerified: business.owner.kycStatus === "VERIFIED",
      },
      hours: business.hours,
    }));

    res.status(200).json({ data, limit });
  } catch (err) {
    next(err);
  }
}

async function update(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const body = req.body as UpdateBusinessInput;
    const business = req.business!;

    if (body.categoryId) {
      const category = await prisma.category.findUnique({
        where: { id: body.categoryId },
      });
      if (!category) {
        throw new HttpError(400, "Invalid category");
      }
    }

    // Product decision: a verified owner's edits go live immediately. The
    // one-time human review is KYC verification; per-business re-approval was
    // removed. Only unverified owners have edits reset to PENDING (human
    // review before anything appears publicly).
    let status = business.status;
    if (business.status === "APPROVED") {
      const owner = await prisma.user.findUnique({
        where: { id: business.ownerId },
        select: { kycStatus: true },
      });
      if (owner?.kycStatus !== "VERIFIED") {
        status = "PENDING";
        console.log(
          `[nookly] Business ${business.id} edited by unverified owner; status reset from APPROVED to PENDING (review required)`
        );
      }
    }

    const updated = await prisma.business.update({
      where: { id: business.id },
      data: {
        ...body,
        whatsappNumber: body.whatsappNumber ?? null,
        status,
      },
    });

    res.status(200).json({ business: updated });
  } catch (err) {
    next(err);
  }
}

// Hard delete. Photos/service items cascade via FK onDelete: Cascade.
// Photo files on disk are cleaned up explicitly since rows vanish on cascade.
async function remove(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const business = req.business!;

    const photos = await prisma.photo.findMany({
      where: { businessId: business.id },
      select: { url: true },
    });
    for (const photo of photos) {
      deleteFileByUrl(photo.url);
    }

    await prisma.business.delete({ where: { id: business.id } });

    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

// Replace all 7 days of a business's hours. Uses upsert keyed on the
// (businessId, dayOfWeek) unique constraint so existing days are overwritten.
async function setHours(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const body = req.body as BusinessHoursInput[];
    const business = req.business!;

    await prisma.$transaction(
      body.map((entry) =>
        prisma.businessHours.upsert({
          where: {
            businessId_dayOfWeek: {
              businessId: business.id,
              dayOfWeek: entry.dayOfWeek,
            },
          },
          update: {
            isClosed: entry.isClosed,
            openTime: entry.openTime ?? null,
            closeTime: entry.closeTime ?? null,
          },
          create: {
            businessId: business.id,
            dayOfWeek: entry.dayOfWeek,
            isClosed: entry.isClosed,
            openTime: entry.openTime ?? null,
            closeTime: entry.closeTime ?? null,
          },
        })
      )
    );

    const hours = await prisma.businessHours.findMany({
      where: { businessId: business.id },
      orderBy: { dayOfWeek: "asc" },
    });

    res.status(200).json({ hours });
  } catch (err) {
    next(err);
  }
}

async function getHours(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const business = req.business!;
    const hours = await prisma.businessHours.findMany({
      where: { businessId: business.id },
      orderBy: { dayOfWeek: "asc" },
    });

    res.status(200).json({ hours });
  } catch (err) {
    next(err);
  }
}

export const businessController = {
  create,
  mine,
  getPublicById,
  nearby,
  featured,
  setHours,
  getHours,
  update,
  remove,
};
