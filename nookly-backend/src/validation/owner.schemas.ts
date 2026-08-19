import { z } from "zod";

export const recordVisitSchema = z.object({
  deviceId: z.string().uuid("Invalid deviceId").optional(),
});

export type RecordVisitBodyInput = z.infer<typeof recordVisitSchema>;