import { z } from "zod";
import { ProofOfAddressType, KycSubmissionStatus } from "@prisma/client";

// Nigerian National Identification Number: exactly 11 digits.
export const NIN_REGEX = /^\d{11}$/;

export const kycSubmissionBodySchema = z.object({
  nin: z
    .string()
    .trim()
    .regex(NIN_REGEX, "NIN must be exactly 11 digits"),
  proofOfAddressType: z.enum(
    [ProofOfAddressType.HOME, ProofOfAddressType.WORKSHOP, ProofOfAddressType.BOTH],
    { message: "proofOfAddressType must be HOME, WORKSHOP, or BOTH" }
  ),
});

export const listKycQuerySchema = z.object({
  status: z
    .enum([KycSubmissionStatus.PENDING, KycSubmissionStatus.VERIFIED, KycSubmissionStatus.REJECTED], {
      message: "Invalid status filter",
    })
    .optional()
    .default(KycSubmissionStatus.PENDING),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export type KycSubmissionBodyInput = z.infer<typeof kycSubmissionBodySchema>;
export type ListKycQuery = z.infer<typeof listKycQuerySchema>;