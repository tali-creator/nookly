import { z } from "zod";

export const createConversationSchema = z.object({
  businessId: z.string().uuid("Invalid businessId"),
  deviceId: z.string().uuid("Invalid deviceId"),
  initialMessage: z
    .string()
    .trim()
    .min(1, "Message is required")
    .max(2000, "Message is too long"),
});

export const mineConversationQuerySchema = z.object({
  businessId: z.string().uuid("Invalid businessId"),
  deviceId: z.string().uuid("Invalid deviceId"),
});

export const sendMessageSchema = z.object({
  text: z.string().trim().min(1, "Message is required").max(2000, "Message is too long"),
  // Optional: present for customer (deviceId) sends; owner replies use their
  // Bearer token instead.
  deviceId: z.string().uuid("Invalid deviceId").optional(),
});

export const messagesQuerySchema = z.object({
  deviceId: z.string().uuid("Invalid deviceId").optional(),
});

export type CreateConversationInput = z.infer<typeof createConversationSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;