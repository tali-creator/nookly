/*
  Warnings:

  - Added the required column `ninMasked` to the `kyc_submissions` table without a default value. This is not possible if the table is not empty.

*/
-- Add as nullable first so existing rows can be backfilled.
ALTER TABLE "kyc_submissions" ADD COLUMN "ninMasked" TEXT;

-- Backfill existing rows. Those rows hold PLAINTEXT NINs (encryption is
-- introduced by this change); compute the same masked form the app uses:
-- all chars replaced with "•" except the last two, whitespace stripped.
UPDATE "kyc_submissions" SET "ninMasked" = '•••••••••' || RIGHT("nin", 2);

-- Now make it NOT NULL.
ALTER TABLE "kyc_submissions" ALTER COLUMN "ninMasked" SET NOT NULL;