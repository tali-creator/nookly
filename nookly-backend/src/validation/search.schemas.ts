import { z } from "zod";

export const nearbySearchQuerySchema = z.object({
  lat: z.coerce
    .number({ error: "Latitude is required and must be a number" })
    .min(-90, "Latitude must be between -90 and 90")
    .max(90, "Latitude must be between -90 and 90"),
  lng: z.coerce
    .number({ error: "Longitude is required and must be a number" })
    .min(-180, "Longitude must be between -180 and 180")
    .max(180, "Longitude must be between -180 and 180"),
  radius: z.coerce
    .number()
    .min(1, "Radius must be between 1 and 50 km")
    .max(50, "Radius must be between 1 and 50 km")
    .optional()
    .default(10),
  category: z.string().uuid("Invalid category id").optional(),
  q: z.string().trim().max(100, "Search term too long").optional(),
  // Only "true"/"1" count as truthy; anything else (or missing) is false.
  openNow: z
    .enum(["true", "false", "1", "0"])
    .transform((v) => v === "true" || v === "1")
    .optional()
    .default(false),
  page: z.coerce
    .number({ error: "Page must be a positive integer" })
    .int("Page must be a positive integer")
    .min(1, "Page must be a positive integer")
    .optional()
    .default(1),
  limit: z.coerce
    .number({ error: "Limit must be between 1 and 50" })
    .int("Limit must be a whole number")
    .min(1, "Limit must be between 1 and 50")
    .max(50, "Limit must be between 1 and 50")
    .optional()
    .default(20),
});

export type NearbySearchQuery = z.infer<typeof nearbySearchQuerySchema>;

export const featuredListQuerySchema = z.object({
  limit: z.coerce
    .number({ error: "Limit must be between 1 and 50" })
    .int("Limit must be a whole number")
    .min(1, "Limit must be between 1 and 50")
    .max(50, "Limit must be between 1 and 50")
    .optional()
    .default(10),
});

export type FeaturedListQuery = z.infer<typeof featuredListQuerySchema>;