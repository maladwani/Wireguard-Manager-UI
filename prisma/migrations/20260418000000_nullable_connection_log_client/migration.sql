-- Make clientId nullable in ConnectionLog to preserve logs after client deletion
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_ConnectionLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT,
    "event" TEXT NOT NULL,
    "ipAddress" TEXT,
    "details" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConnectionLog_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "VPNClient" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_ConnectionLog" SELECT "id", "clientId", "event", "ipAddress", "details", "createdAt" FROM "ConnectionLog";

DROP TABLE "ConnectionLog";

ALTER TABLE "new_ConnectionLog" RENAME TO "ConnectionLog";

CREATE INDEX "ConnectionLog_clientId_idx" ON "ConnectionLog"("clientId");
CREATE INDEX "ConnectionLog_createdAt_idx" ON "ConnectionLog"("createdAt");

PRAGMA foreign_keys=ON;
