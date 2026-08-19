import { z } from "zod";

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export const businessHoursEntrySchema = z
  .object({
    dayOfWeek: z.number().int().min(0, "dayOfWeek must be between 0 and 6").max(6),
    isClosed: z.boolean(),
    openTime: z
      .string()
      .regex(TIME_REGEX, "openTime must be in HH:mm 24-hour format")
      .nullable()
      .optional(),
    closeTime: z
      .string()
      .regex(TIME_REGEX, "closeTime must be in HH:mm 24-hour format")
      .nullable()
      .optional(),
  })
  .superRefine((entry, ctx) => {
    if (entry.isClosed) {
      // Closed all day: no times allowed.
      if (entry.openTime != null || entry.closeTime != null) {
        ctx.addIssue({
          code: "custom",
          path: ["openTime"],
          message: "openTime/closeTime must be null when isClosed is true",
        });
      }
      return;
    }
    if (!entry.openTime || !entry.closeTime) {
      ctx.addIssue({
        code: "custom",
        path: ["openTime"],
        message: "openTime and closeTime are required when the business is open",
      });
      return;
    }
    // HH:mm is zero-padded, so lexicographic compare == chronological compare.
    // Overnight shifts (closeTime < openTime, e.g. bar open 18:00-02:00) are
    // NOT supported in this pass; assume closeTime > openTime always.
    if (entry.openTime >= entry.closeTime) {
      ctx.addIssue({
        code: "custom",
        path: ["openTime"],
        message: "openTime must be before closeTime",
      });
    }
  });

export const setBusinessHoursSchema = z
  .array(businessHoursEntrySchema)
  .min(7, "Exactly 7 entries are required (one per day)")
  .max(7, "Exactly 7 entries are required (one per day)")
  .refine(
    (entries) => new Set(entries.map((e) => e.dayOfWeek)).size === 7,
    { message: "One entry per day is required (dayOfWeek 0-6 must be unique)" }
  );

export type BusinessHoursInput = z.infer<typeof businessHoursEntrySchema>;
