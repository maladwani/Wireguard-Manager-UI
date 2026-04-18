-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "hashedPassword" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'admin',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "VPNClient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "publicKey" TEXT NOT NULL,
    "privateKeyEncrypted" TEXT NOT NULL,
    "presharedKey" TEXT,
    "allowedIPs" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "dns" TEXT,
    "endpoint" TEXT,
    "dataUsage" BIGINT NOT NULL DEFAULT 0,
    "expiresAt" DATETIME,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ConnectionLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "ipAddress" TEXT,
    "details" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConnectionLog_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "VPNClient" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "VPNClient_publicKey_key" ON "VPNClient"("publicKey");

-- CreateIndex
CREATE INDEX "ConnectionLog_clientId_idx" ON "ConnectionLog"("clientId");

-- CreateIndex
CREATE INDEX "ConnectionLog_createdAt_idx" ON "ConnectionLog"("createdAt");
