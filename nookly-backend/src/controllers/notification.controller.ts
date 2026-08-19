import type { NextFunction, Request, Response } from "express";
import prisma from "../models/prisma";
import { HttpError } from "../utils/http-error";
import { getParam } from "../utils/params";

const PAGE_SIZE = 20;

function toJson(n: {
  id: string;
  type: string;
  title: string;
  body: string;
  data: unknown;
  readAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    data: n.data ?? null,
    read: n.readAt !== null,
    readAt: n.readAt,
    createdAt: n.createdAt,
  };
}

// Signed-in user's notification inbox, newest first, plus the unread count
// so the client can render the badge without a second request.
async function list(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.id;
    const page = Math.max(1, Number(req.query.page) || 1);
    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: PAGE_SIZE,
        skip: (page - 1) * PAGE_SIZE,
      }),
      prisma.notification.count({ where: { userId } }),
      prisma.notification.count({ where: { userId, readAt: null } }),
    ]);

    res.status(200).json({
      notifications: notifications.map(toJson),
      total,
      unreadCount,
      page,
      pageSize: PAGE_SIZE,
      hasMore: page * PAGE_SIZE < total,
    });
  } catch (err) {
    next(err);
  }
}

// Unread badge count only.
async function unreadCount(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const unreadCount = await prisma.notification.count({
      where: { userId: req.user!.id, readAt: null },
    });
    res.status(200).json({ unreadCount });
  } catch (err) {
    next(err);
  }
}

// Mark a single notification read. Only the recipient can do so.
async function markRead(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.id;
    const notification = await prisma.notification.findFirst({
      where: { id: getParam(req, "id"), userId },
    });
    if (!notification) {
      throw new HttpError(404, "Notification not found");
    }
    const updated = await prisma.notification.update({
      where: { id: notification.id },
      data: { readAt: notification.readAt ?? new Date() },
    });
    res.status(200).json({ notification: toJson(updated) });
  } catch (err) {
    next(err);
  }
}

// Mark every unread notification read. Returns the new unread count.
async function markAllRead(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user!.id, readAt: null },
      data: { readAt: new Date() },
    });
    res.status(200).json({ unreadCount: 0 });
  } catch (err) {
    next(err);
  }
}

export const notificationController = {
  list,
  unreadCount,
  markRead,
  markAllRead,
};