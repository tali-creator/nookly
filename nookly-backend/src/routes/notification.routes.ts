import { Router } from "express";
import { notificationController } from "../controllers/notification.controller";
import { requireAuth } from "../middleware/auth.middleware";

export const notificationRouter = Router();

notificationRouter.use(requireAuth);

// Signed-in user's notification inbox + unread badge count.
notificationRouter.get("/", notificationController.list);
notificationRouter.get("/unread-count", notificationController.unreadCount);
notificationRouter.patch("/read-all", notificationController.markAllRead);
notificationRouter.patch("/:id/read", notificationController.markRead);