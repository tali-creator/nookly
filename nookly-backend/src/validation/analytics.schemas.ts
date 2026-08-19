import { z } from "zod";

export const analyticsEventBodySchema = z.object({
  type: z.enum(["PROFILE_VIEW", "CONTACT_CALL", "CONTACT_WHATSAPP"]),
  deviceId: z.string().uuid("Invalid deviceId").optional(),
});

export const analyticsQuerySchema = z.object({
  period: z.enum(["7d", "30d", "all"]).default("7d"),
});

export type AnalyticsEventBodyInput = z.infer<typeof analyticsEventBodySchema>;