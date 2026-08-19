-- CreateEnum
CREATE TYPE "UserKycStatus" AS ENUM ('NOT_SUBMITTED', 'PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "KycSubmissionStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ProofOfAddressType" AS ENUM ('HOME', 'WORKSHOP', 'BOTH');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "displayName" TEXT,
ADD COLUMN     "kycStatus" "UserKycStatus" NOT NULL DEFAULT 'NOT_SUBMITTED',
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "socialHandles" JSONB,
ADD COLUMN     "whatsappNumber" TEXT;

-- CreateTable
CREATE TABLE "kyc_submissions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "nin" TEXT NOT NULL,
    "selfieUrl" TEXT NOT NULL,
    "certificateUrl" TEXT,
    "proofOfAddressType" "ProofOfAddressType" NOT NULL,
    "proofOfAddressHomeUrl" TEXT,
    "proofOfAddressWorkshopUrl" TEXT,
    "status" "KycSubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedByAdminId" UUID,

    CONSTRAINT "kyc_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "kyc_submissions_userId_key" ON "kyc_submissions"("userId");

-- CreateIndex
CREATE INDEX "kyc_submissions_status_idx" ON "kyc_submissions"("status");

-- AddForeignKey
ALTER TABLE "kyc_submissions" ADD CONSTRAINT "kyc_submissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyc_submissions" ADD CONSTRAINT "kyc_submissions_reviewedByAdminId_fkey" FOREIGN KEY ("reviewedByAdminId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
