import { z } from "zod";

const PHONE_REGEX = /^\+?[0-9\s().-]{7,25}$/;

const phoneSchema = z
  .string()
  .trim()
  .regex(PHONE_REGEX, "Invalid phone number");

const optionalPhoneSchema = z
  .union([z.string().trim(), z.null()])
  .transform((v) => (v === null || v.trim() === "" ? null : v.trim()))
  .pipe(z.string().regex(PHONE_REGEX, "Invalid phone number").nullable())
  .optional();

export const createBusinessSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  categoryId: z.string().uuid("Invalid category id"),
  description: z.string().trim().min(1, "Description is required"),
  address: z.string().trim().min(1, "Address is required").max(255),
  lat: z.number().min(-90, "Latitude must be between -90 and 90").max(90),
  lng: z
    .number()
    .min(-180, "Longitude must be between -180 and 180")
    .max(180),
  phone: phoneSchema,
  whatsappNumber: optionalPhoneSchema,
  // Optional owner-supplied search keywords (free text). Tokenized with the
  // name/description/address in the nearby search.
  keywords: z
    .string()
    .trim()
    .max(255, "Keywords must be 255 characters or fewer")
    .optional(),
});

export const updateBusinessSchema = createBusinessSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export const serviceItemSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  price: z
    .number()
    .positive("Price must be greater than 0")
    .refine((v) => Math.round(v * 100) === v * 100, {
      message: "Price can have at most 2 decimal places",
    }),
  description: z.string().trim().max(1000).optional(),
});

export type CreateBusinessInput = z.infer<typeof createBusinessSchema>;
export type UpdateBusinessInput = z.infer<typeof updateBusinessSchema>;
export type ServiceItemInput = z.infer<typeof serviceItemSchema>;
