-- CreateTable
CREATE TABLE "BandwidthLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rx" BIGINT NOT NULL DEFAULT 0,
    "tx" BIGINT NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "BandwidthLog_createdAt_idx" ON "BandwidthLog"("createdAt");
