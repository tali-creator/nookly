-- CreateEnum
CREATE TYPE "AnalyticsEventType" AS ENUM ('PROFILE_VIEW', 'CONTACT_CALL', 'CONTACT_WHATSAPP');

-- CreateTable
CREATE TABLE "analytics_events" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "type" "AnalyticsEventType" NOT NULL,
    "deviceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "analytics_events_businessId_type_createdAt_idx" ON "analytics_events"("businessId", "type", "createdAt");

-- AddForeignKey
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
