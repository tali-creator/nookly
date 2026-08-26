import type { NextFunction, Request, Response } from "express";
import prisma from "../models/prisma";
import { HttpError } from "../utils/http-error";
import { getParam } from "../utils/params";
import { verifyToken } from "../utils/jwt";
import { createNotification } from "../lib/notifications";
import { emitToDevice, emitToUser } from "../lib/socket";
import type {
  CreateConversationInput,
  SendMessageInput,
} from "../validation/conversation.schemas";

function messageToJson(msg: {
  id: string;
  senderType: string;
  senderDeviceId: string | null;
  text: string;
  createdAt: Date;
}) {
  return {
    id: msg.id,
    senderType: msg.senderType,
    senderDeviceId: msg.senderDeviceId,
    text: msg.text,
    createdAt: msg.createdAt,
  };
}

// Create a conversation (or reuse the existing one for this business+device)
// and store the customer's first message. Public, unauthenticated route.
async function create(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { businessId, deviceId, initialMessage } =
      req.body as CreateConversationInput;

    const business = await prisma.business.findFirst({
      where: { id: businessId, status: "APPROVED" },
      select: { id: true, ownerId: true, name: true },
    });
    if (!business) {
      throw new HttpError(400, "Business not found or not approved");
    }

    let conversation = await prisma.conversation.findUnique({
      where: {
        businessId_deviceId: { businessId, deviceId },
      },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: { businessId, deviceId },
      });
    }

    const message = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderType: "CUSTOMER",
        senderDeviceId: deviceId,
        text: initialMessage,
      },
    });

    // A new customer message reopens the thread.
    if (conversation.status !== "OPEN") {
      conversation = await prisma.conversation.update({
        where: { id: conversation.id },
        data: { status: "OPEN" },
      });
    }

    // Real-time in-app notification to the owner of the new customer message.
    await createNotification({
      userId: business.ownerId,
      type: "NEW_MESSAGE",
      title: "New customer message",
      body: `Someone messaged you about ${business.name}: "${initialMessage.slice(0, 90)}${initialMessage.length > 90 ? "…" : ""}"`,
      data: { businessId: business.id, conversationId: conversation.id },
    });

    res.status(201).json({ conversation, message: messageToJson(message) });
  } catch (err) {
    next(err);
  }
}

// Find the customer's thread for a given business. 404 when none exists yet.
async function mine(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { businessId, deviceId } = res.locals.validatedQuery as {
      businessId: string;
      deviceId: string;
    };

    const conversation = await prisma.conversation.findUnique({
      where: { businessId_deviceId: { businessId, deviceId } },
    });
    if (!conversation) {
      throw new HttpError(404, "Conversation not found");
    }

    res.status(200).json({ conversation });
  } catch (err) {
    next(err);
  }
}

// List messages in a thread. The customer who owns it (deviceId) can always
// read; the business owner can read via their token. Others are rejected.
async function messages(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const conversation = await prisma.conversation.findUnique({
      where: { id: getParam(req, "id") },
      include: { business: { select: { ownerId: true } } },
    });
    if (!conversation) {
      throw new HttpError(404, "Conversation not found");
    }

    const deviceId = (req.query.deviceId as string | undefined) ?? "";
    const isOwner = await isOwnerOf(conversation.business.ownerId, req);
    if (!isOwner && deviceId !== conversation.deviceId) {
      throw new HttpError(403, "You do not have access to this conversation");
    }

    const rows = await prisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: "asc" },
    });

    res.status(200).json({ messages: rows.map(messageToJson) });
  } catch (err) {
    next(err);
  }
}

// Append a message to a thread. The owning customer (deviceId) sends as
// CUSTOMER; the business owner (token) sends as OWNER.
async function send(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { text, deviceId } = req.body as SendMessageInput;

    const conversation = await prisma.conversation.findUnique({
      where: { id: getParam(req, "id") },
      include: { business: { select: { ownerId: true } } },
    });
    if (!conversation) {
      throw new HttpError(404, "Conversation not found");
    }

    const owner = await isOwnerOf(conversation.business.ownerId, req);
    const isCustomer = deviceId === conversation.deviceId;

    if (!owner && !isCustomer) {
      throw new HttpError(403, "You cannot send messages here");
    }

    const message = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderType: owner ? "OWNER" : "CUSTOMER",
        senderDeviceId: owner ? null : deviceId,
        text,
      },
    });

    if (!owner) {
      // Customer replied: notify the owner in real time.
      const business = await prisma.business.findUnique({
        where: { id: conversation.businessId },
        select: { name: true },
      });
      await createNotification({
        userId: conversation.business.ownerId,
        type: "NEW_MESSAGE",
        title: "New customer message",
        body: `You have a new message${business ? ` about ${business.name}` : ""}: "${text.slice(0, 90)}${text.length > 90 ? "…" : ""}"`,
        data: { businessId: conversation.businessId, conversationId: conversation.id },
      });
      // Push the actual message to the owner's socket room so the open thread
      // updates live, not just the notification badge.
      emitToUser(conversation.business.ownerId, "conversation:message", {
        conversationId: conversation.id,
        businessId: conversation.businessId,
        message: messageToJson(message),
      });
    } else {
      // Owner replied: notify the customer in real time. Customers are
      // anonymous (no user/notification row), so the socket is their only
      // delivery channel — push to the device room and let the client surface
      // it as a notification/toast.
      emitToDevice(conversation.deviceId, "conversation:message", {
        conversationId: conversation.id,
        businessId: conversation.businessId,
        message: messageToJson(message),
      });
    }

    res.status(201).json({ message: messageToJson(message) });
  } catch (err) {
    next(err);
  }
}

// True when the request carries a valid token for the given ownerId. Used to
// let a business owner read/reply to their own conversations without a
// deviceId. Any other (or no) token is treated as "not the owner".
async function isOwnerOf(
  ownerId: string,
  req: Request
): Promise<boolean> {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) return false;

  try {
    const payload = verifyToken(header.slice("Bearer ".length).trim());
    return payload.id === ownerId && payload.role === "BUSINESS_OWNER";
  } catch {
    return false;
  }
}

// Owner inbox: every conversation across the authenticated owner's businesses,
// newest first. "unread" counts customer messages that arrived after the last
// owner reply (a lightweight needs-attention signal; message reads aren't
// tracked in the schema).
async function ownerInbox(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const conversations = await prisma.conversation.findMany({
      where: { business: { ownerId: req.user!.id } },
      include: {
        business: { select: { id: true, name: true, status: true } },
        messages: {
          orderBy: { createdAt: "asc" },
          select: {
            senderType: true,
            text: true,
            createdAt: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    const data = conversations.map((c) => {
      const messages = c.messages;
      const last = messages[messages.length - 1] ?? null;
      let unread = 0;
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].senderType === "OWNER") break;
        unread += 1;
      }
      return {
        id: c.id,
        businessId: c.businessId,
        businessName: c.business.name,
        businessStatus: c.business.status,
        messageCount: messages.length,
        unread,
        lastMessage: last
          ? {
              senderType: last.senderType,
              text: last.text,
              createdAt: last.createdAt,
            }
          : null,
      };
    });

    res.status(200).json({ conversations: data });
  } catch (err) {
    next(err);
  }
}

export const conversationController = {
  create,
  mine,
  messages,
  send,
  ownerInbox,
};