import { z } from "zod";
import { BusinessStatus, UserKycStatus, UserRole } from "@prisma/client";

const BUSINESS_STATUSES = [
  BusinessStatus.PENDING,
  BusinessStatus.APPROVED,
  BusinessStatus.REJECTED,
  BusinessStatus.SUSPENDED,
] as const;

export const moderationReasonSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(10, "Reason must be at least 10 characters long"),
});

// Body for PATCH /admin/businesses/:id/feature. durationDays omitted => the
// featured period is indefinite (featuredUntil = null).
export const featureBusinessSchema = z.object({
  durationDays: z
    .number()
    .int("durationDays must be a whole number")
    .min(1, "durationDays must be at least 1")
    .max(3650, "durationDays must be at most 3650")
    .optional(),
});

export const listBusinessesQuerySchema = z.object({
  status: z
    .enum(BUSINESS_STATUSES, { message: "Invalid status filter" })
    .optional()
    .default(BusinessStatus.PENDING),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export const listAuditLogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

// GET /admin/users — directory of registered accounts. role/kycStatus filter
// independently; kycStatus is only meaningful for BUSINESS_OWNER but applying
// it alongside role=ADMIN simply yields an empty set (no error). By default
// archived (soft-deleted) accounts are excluded; pass deleted=true to list
// them (used by the Restore view).
export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  role: z.enum([UserRole.BUSINESS_OWNER, UserRole.ADMIN]).optional(),
  kycStatus: z
    .enum([
      UserKycStatus.NOT_SUBMITTED,
      UserKycStatus.PENDING,
      UserKycStatus.VERIFIED,
      UserKycStatus.REJECTED,
    ])
    .optional(),
  q: z
    .string()
    .trim()
    .min(1, "Search query must not be empty")
    .max(120)
    .optional(),
  deleted: z
    .enum(["true", "false"])
    .optional()
    .default("false"),
});

export type ModerationReasonInput = z.infer<typeof moderationReasonSchema>;
export type FeatureBusinessInput = z.infer<typeof featureBusinessSchema>;
export type ListBusinessesQuery = z.infer<typeof listBusinessesQuerySchema>;
export type ListAuditLogQuery = z.infer<typeof listAuditLogQuerySchema>;
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;

// POST /admin/users — admin creates an account directly (e.g. an admin
// colleague, or an owner whose signup had an issue). Password is hashed
// server-side exactly like a normal signup.
export const createUserSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum([UserRole.BUSINESS_OWNER, UserRole.ADMIN]).optional().default(UserRole.BUSINESS_OWNER),
  displayName: z.string().trim().min(1).max(80).optional(),
  phone: z.string().trim().min(7).max(20).optional(),
});

// PATCH /admin/users/:id — admin edits a user's profile fields. Email is NOT
// editable here (it's the account identifier; changing it is the separate,
// more sensitive flow in the owner account settings). role changes are allowed
// so a colleague can be promoted to ADMIN (or demoted).
export const updateUserSchema = z.object({
  displayName: z.string().trim().min(1).max(80).nullable().optional(),
  phone: z.string().trim().min(7).max(20).nullable().optional(),
  role: z.enum([UserRole.BUSINESS_OWNER, UserRole.ADMIN]).optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;