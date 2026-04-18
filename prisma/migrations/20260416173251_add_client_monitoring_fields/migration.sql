-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_VPNClient" (
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
    "lastHandshake" DATETIME,
    "lastEndpoint" TEXT,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_VPNClient" ("address", "allowedIPs", "createdAt", "dataUsage", "dns", "email", "enabled", "endpoint", "expiresAt", "id", "name", "presharedKey", "privateKeyEncrypted", "publicKey", "updatedAt") SELECT "address", "allowedIPs", "createdAt", "dataUsage", "dns", "email", "enabled", "endpoint", "expiresAt", "id", "name", "presharedKey", "privateKeyEncrypted", "publicKey", "updatedAt" FROM "VPNClient";
DROP TABLE "VPNClient";
ALTER TABLE "new_VPNClient" RENAME TO "VPNClient";
CREATE UNIQUE INDEX "VPNClient_publicKey_key" ON "VPNClient"("publicKey");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
