import type { NotificationType } from "@prisma/client";
import prisma from "../models/prisma";
import { emitToUser } from "./socket";

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

// Persist a notification and deliver it in real time to the recipient's
// socket.io room. Persist first so a client that connects later (or missed
// the live event) still sees it in the inbox; the socket emit is the
// real-time fast path.
export async function createNotification(
  input: CreateNotificationInput
): Promise<void> {
  const notification = await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      data: (input.data ?? null) as never,
    },
  });
  emitToUser(input.userId, "notification:new", notification);
}

// Convenience for notifying a business owner about their listing.
export function notifyBusinessOwner(params: {
  ownerId: string;
  type: "BUSINESS_APPROVED" | "BUSINESS_REJECTED" | "BUSINESS_SUSPENDED";
  businessName: string;
  businessId: string;
  reason?: string;
}): Promise<void> {
  const titleByType = {
    BUSINESS_APPROVED: "Listing approved",
    BUSINESS_REJECTED: "Listing rejected",
    BUSINESS_SUSPENDED: "Listing suspended",
  };
  const bodyByType = {
    BUSINESS_APPROVED: `${params.businessName} is now live and visible to customers.`,
    BUSINESS_REJECTED: `${params.businessName} was rejected.${
      params.reason ? ` Reason: ${params.reason}` : ""
    }`,
    BUSINESS_SUSPENDED: `${params.businessName} was suspended.${
      params.reason ? ` Reason: ${params.reason}` : ""
    }`,
  };
  return createNotification({
    userId: params.ownerId,
    type: params.type,
    title: titleByType[params.type],
    body: bodyByType[params.type],
    data: { businessId: params.businessId },
  });
}

// Convenience for notifying a user about their KYC status.
export function notifyKycUser(params: {
  userId: string;
  type: "KYC_VERIFIED" | "KYC_REJECTED";
  reason?: string;
}): Promise<void> {
  return createNotification({
    userId: params.userId,
    type: params.type,
    title: params.type === "KYC_VERIFIED" ? "Identity verified" : "Identity verification rejected",
    body:
      params.type === "KYC_VERIFIED"
        ? "Your identity is verified. Your businesses are now live automatically."
        : `Your identity verification was rejected.${
            params.reason ? ` Reason: ${params.reason}` : ""
          }`,
    data: { userId: params.userId },
  });
}