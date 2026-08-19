import { z } from "zod";

export const favoriteBodySchema = z.object({
  deviceId: z.string().uuid("Invalid deviceId"),
  businessId: z.string().uuid("Invalid businessId"),
});

export const favoritesListQuerySchema = z.object({
  deviceId: z.string().uuid("Invalid deviceId"),
});

export const favoritesCheckQuerySchema = z.object({
  deviceId: z.string().uuid("Invalid deviceId"),
  businessId: z.string().uuid("Invalid businessId"),
});

export type FavoriteBodyInput = z.infer<typeof favoriteBodySchema>;