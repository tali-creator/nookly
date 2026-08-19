import { z } from "zod";
import { UserRole } from "@prisma/client";

// Minimum age to open a Nookly owner account. Compare by exact date, never by
// year subtraction: a year-diff check would wrongly pass someone who turns the
// minimum age tomorrow.
export const MINIMUM_AGE_YEARS = 16;

function isMinimumAgeMet(dateOfBirth: Date): boolean {
  const earliestAllowed = new Date(dateOfBirth);
  earliestAllowed.setFullYear(earliestAllowed.getFullYear() + MINIMUM_AGE_YEARS);
  return new Date() >= earliestAllowed;
}

export const signupSchema = z
  .object({
    email: z.string().trim().toLowerCase().email("Invalid email address"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters long"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
    dateOfBirth: z.coerce
      .date({
        message: "Invalid date of birth",
      })
      .refine((d) => !Number.isNaN(d.getTime()), {
        message: "Invalid date of birth",
      })
      .refine((d) => d <= new Date(), {
        message: "Date of birth cannot be in the future",
      })
      .refine(isMinimumAgeMet, {
        message: `You must be at least ${MINIMUM_AGE_YEARS} years old`,
      })
      .optional(),
    role: z
      .enum([UserRole.BUSINESS_OWNER], {
        message: "Role must be BUSINESS_OWNER",
      })
      .optional()
      .default(UserRole.BUSINESS_OWNER),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("Invalid email address"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  newPassword: z
    .string()
    .min(8, "New password must be at least 8 characters long"),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
