-- CreateTable
CREATE TABLE "owner_visits" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "deviceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "owner_visits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "owner_visits_ownerId_createdAt_idx" ON "owner_visits"("ownerId", "createdAt");

-- AddForeignKey
ALTER TABLE "owner_visits" ADD CONSTRAINT "owner_visits_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
