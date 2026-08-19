import { z } from "zod";

const PHONE_REGEX = /^\+?[0-9\s().-]{7,25}$/;

const optionalPhoneSchema = z
  .union([z.string().trim(), z.null()])
  .transform((v) => (v === null || v.trim() === "" ? null : v.trim()))
  .pipe(z.string().regex(PHONE_REGEX, "Invalid phone number").nullable())
  .optional();

// bio: short "about me" — max 300 chars. Null or empty clears it.
const optionalBioSchema = z
  .union([z.string().trim(), z.null()])
  .transform((v) => (v === null || v.trim() === "" ? null : v.trim()))
  .pipe(z.string().max(300, "Bio must be at most 300 characters").nullable())
  .optional();

// preferredContactMethod: PHONE | WHATSAPP | EMAIL. Null clears it.
const optionalContactMethodSchema = z
  .union([z.enum(["PHONE", "WHATSAPP", "EMAIL"]), z.null()])
  .optional();

// socialHandles is free-form key-value, but only known keys are accepted.
// Unknown keys are rejected (strict object) so a stray typo fails loudly.
// SECURITY NOTE: this write-side validation is the ONLY guard on this field's
// shape. It is stored as JSONB and served back to profile.html, which renders
// it via input.value (never innerHTML). If rendering ever changes, it MUST
// keep using textContent/.value — never innerHTML — or a future handle value
// could become a stored-XSS vector.
export const socialHandlesSchema = z
  .object({
    instagram: z.string().trim().max(120).optional(),
    facebook: z.string().trim().max(120).optional(),
    twitter: z.string().trim().max(120).optional(),
    tiktok: z.string().trim().max(120).optional(),
  })
  .strict()
  .optional();

export const updateProfileSchema = z
  .object({
    displayName: z
      .union([z.string().trim(), z.null()])
      .transform((v) => (v === null || v.trim() === "" ? null : v.trim()))
      .pipe(z.string().max(120, "Display name must be at most 120 characters").nullable())
      .optional(),
    bio: optionalBioSchema,
    preferredContactMethod: optionalContactMethodSchema,
    phone: optionalPhoneSchema,
    whatsappNumber: optionalPhoneSchema,
    socialHandles: socialHandlesSchema,
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z
    .string()
    .min(8, "New password must be at least 8 characters long")
    .max(128, "New password must be at most 128 characters"),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;