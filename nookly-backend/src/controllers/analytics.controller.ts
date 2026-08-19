import type { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import prisma from "../models/prisma";
import { rateLimitHit } from "../lib/rate-limit";
import { clientIp } from "../lib/client-ip";
import { HttpError } from "../utils/http-error";
import { getParam } from "../utils/params";
import type { AnalyticsEventBodyInput } from "../validation/analytics.schemas";

const EVENT_RATE_LIMITS: Record<
  string,
  { max: number; windowMs: number }
> = {
  // A page refresh/reopen shouldn't inflate views: 1 profile view per device
  // per business per 5 minutes.
  PROFILE_VIEW: { max: 1, windowMs: 5 * 60 * 1000 },
  // Clicks are explicit user actions; still cap them to stop spam.
  CONTACT_CALL: { max: 5, windowMs: 5 * 60 * 1000 },
  CONTACT_WHATSAPP: { max: 5, windowMs: 5 * 60 * 1000 },
};

// Rate limit keyed on type + business + BOTH deviceId and client IP. Two
// independent buckets must both pass, so neither a rotating deviceId (client-
// controlled UUID) nor a shared IP can alone defeat the limit:
//   - deviceId bucket: 1 view / 5 clicks per device per business per window.
//   - IP bucket: same limits per source address per business.
// When deviceId is omitted, key the anonymous case on IP alone (NOT a shared
// "anonymous" bucket), so many anonymous users are not collapsed into one
// bucket that a single request from one machine can exhaust.
export function rateLimitEvent(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const { type, deviceId } = req.body as { type?: string; deviceId?: string };
  const businessId = getParam(req, "id");
  const limits = type ? EVENT_RATE_LIMITS[type] : undefined;
  if (!limits) {
    next();
    return;
  }
  const ip = clientIp(req);

  const deviceKey = deviceId
    ? `event:${type}:${businessId}:device:${deviceId}`
    : null;
  const ipKey = `event:${type}:${businessId}:ip:${ip}`;

  // Anonymous requests (no deviceId) must pass the IP bucket; deviceId-bearing
  // requests must pass BOTH buckets independently.
  if (
    (deviceKey !== null && rateLimitHit(deviceKey, limits.max, limits.windowMs)) ||
    rateLimitHit(ipKey, limits.max, limits.windowMs)
  ) {
    res.status(429).json({ error: "Too many requests, please try again later" });
    return;
  }
  next();
}

async function track(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const businessId = getParam(req, "id");
    const { type, deviceId } = req.body as AnalyticsEventBodyInput;

    const business = await prisma.business.findFirst({
      where: { id: businessId, status: "APPROVED" },
      select: { id: true },
    });
    if (!business) {
      throw new HttpError(400, "Business not found or not approved");
    }

    // Fire-and-forget: acknowledge immediately, persist in the background so
    // the frontend doesn't wait on the write.
    res.status(202).json({ status: "accepted" });

    prisma.analyticsEvent
      .create({ data: { businessId, type, deviceId: deviceId ?? null } })
      .catch((err) => {
        console.error("[nookly:analytics] failed to persist event", err);
      });
  } catch (err) {
    next(err);
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;
type EventType = "PROFILE_VIEW" | "CONTACT_CALL" | "CONTACT_WHATSAPP";

async function getAnalytics(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const businessId = getParam(req, "id");
    const { period } = res.locals.validatedQuery as { period: "7d" | "30d" | "all" };

    const days = period === "7d" ? 7 : period === "30d" ? 30 : null;
    const since = days ? new Date(Date.now() - days * DAY_MS) : null;

    const where: Prisma.AnalyticsEventWhereInput = { businessId };
    if (since) {
      where.createdAt = { gte: since };
    }

    const grouped = await prisma.analyticsEvent.groupBy({
      by: ["type"],
      where,
      _count: { _all: true },
    });

    const totals = {
      PROFILE_VIEW: 0,
      CONTACT_CALL: 0,
      CONTACT_WHATSAPP: 0,
    } as Record<EventType, number>;
    for (const g of grouped) {
      totals[g.type as EventType] = g._count._all;
    }

    // Daily series for the dashboard chart. Bucketed by UTC date (whole days,
    // no partial buckets on either edge). NOTE: not timezone-aware; revisit
    // if owners need local-day bucketing.
    let daily: {
      date: string;
      profileViews: number;
      contactCalls: number;
      contactWhatsapp: number;
    }[] = [];

    if (days) {
      const events = await prisma.analyticsEvent.findMany({
        where,
        select: { type: true, createdAt: true },
      });

      const byDay = new Map<
        string,
        { profileViews: number; contactCalls: number; contactWhatsapp: number }
      >();
      const now = new Date();
      for (let i = days - 1; i >= 0; i--) {
        const day = new Date(now.getTime() - i * DAY_MS);
        byDay.set(day.toISOString().slice(0, 10), {
          profileViews: 0,
          contactCalls: 0,
          contactWhatsapp: 0,
        });
      }
      for (const e of events) {
        const day = byDay.get(e.createdAt.toISOString().slice(0, 10));
        if (!day) continue;
        if (e.type === "PROFILE_VIEW") day.profileViews += 1;
        else if (e.type === "CONTACT_CALL") day.contactCalls += 1;
        else day.contactWhatsapp += 1;
      }
      daily = Array.from(byDay, ([date, counts]) => ({ date, ...counts }));
    }

    res.status(200).json({
      period,
      profileViews: totals.PROFILE_VIEW,
      contactCalls: totals.CONTACT_CALL,
      contactWhatsapp: totals.CONTACT_WHATSAPP,
      daily,
    });
  } catch (err) {
    next(err);
  }
}

export const analyticsController = { track, getAnalytics };