-- CreateTable
CREATE TABLE "favorites" (
    "id" UUID NOT NULL,
    "deviceId" TEXT NOT NULL,
    "businessId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "favorites_deviceId_idx" ON "favorites"("deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "favorites_deviceId_businessId_key" ON "favorites"("deviceId", "businessId");

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
