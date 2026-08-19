-- CreateEnum
CREATE TYPE "PreferredContactMethod" AS ENUM ('PHONE', 'WHATSAPP', 'EMAIL');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "bio" TEXT,
ADD COLUMN     "preferredContactMethod" "PreferredContactMethod";
