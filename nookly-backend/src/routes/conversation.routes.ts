import { Router } from "express";
import { conversationController } from "../controllers/conversation.controller";
import { requireAuth, requireRole } from "../middleware/auth.middleware";
import { createRateLimiter } from "../lib/rate-limit";
import { clientIp } from "../lib/client-ip";
import { validate, validateQuery } from "../middleware/validate.middleware";
import {
  createConversationSchema,
  messagesQuerySchema,
  mineConversationQuerySchema,
  sendMessageSchema,
} from "../validation/conversation.schemas";

export const conversationRouter = Router();

// Public, unauthenticated routes (same trust model as favorites): the sender
// is identified by a client-generated deviceId. Rate limits guard the write
// paths against spam — per deviceId AND per client IP so deviceId rotation
// can't bypass the IP cap.
const conversationDeviceLimiter = createRateLimiter({
  max: 30,
  windowMs: 60 * 60 * 1000,
  getKey: (req) =>
    (req.body as { deviceId?: string } | undefined)?.deviceId ?? null,
});

const conversationIpLimiter = createRateLimiter({
  max: 60,
  windowMs: 60 * 60 * 1000,
  getKey: (req) => `conversations:ip:${clientIp(req)}`,
});

const messageDeviceLimiter = createRateLimiter({
  max: 120,
  windowMs: 60 * 60 * 1000,
  getKey: (req) =>
    (req.body as { deviceId?: string } | undefined)?.deviceId ?? null,
});

const messageIpLimiter = createRateLimiter({
  max: 240,
  windowMs: 60 * 60 * 1000,
  getKey: (req) => `messages:ip:${clientIp(req)}`,
});

conversationRouter.post(
  "/",
  conversationIpLimiter,
  conversationDeviceLimiter,
  validate(createConversationSchema),
  conversationController.create
);
conversationRouter.get(
  "/mine",
  validateQuery(mineConversationQuerySchema),
  conversationController.mine
);
// Owner inbox: authenticated business owner lists all threads across their
// businesses. Registered before /:id/messages (different segment count, no
// conflict, but kept here with the other list route for clarity).
conversationRouter.get(
  "/owner",
  requireAuth,
  requireRole("BUSINESS_OWNER"),
  conversationController.ownerInbox
);
conversationRouter.get(
  "/:id/messages",
  validateQuery(messagesQuerySchema),
  conversationController.messages
);
conversationRouter.post(
  "/:id/messages",
  messageIpLimiter,
  messageDeviceLimiter,
  validate(sendMessageSchema),
  conversationController.send
);