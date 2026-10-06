-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Share" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT,
    "uploadLocked" BOOLEAN NOT NULL DEFAULT false,
    "isZipReady" BOOLEAN NOT NULL DEFAULT false,
    "views" INTEGER NOT NULL DEFAULT 0,
    "downloads" INTEGER NOT NULL DEFAULT 0,
    "expiration" DATETIME NOT NULL,
    "description" TEXT,
    "removedReason" TEXT,
    "accentColor" TEXT,
    "previewStyle" TEXT NOT NULL DEFAULT 'full',
    "visibility" TEXT NOT NULL DEFAULT 'PRIVATE',
    "groupId" TEXT,
    "virusScanStatus" TEXT NOT NULL DEFAULT 'not_scanned',
    "virusScanStartedAt" DATETIME,
    "virusScanCompletedAt" DATETIME,
    "virusScanThreats" TEXT,
    "virusScanError" TEXT,
    "creatorId" TEXT,
    "reverseShareId" TEXT,
    "storageProvider" TEXT NOT NULL DEFAULT 'LOCAL',
    CONSTRAINT "Share_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Share_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "UserGroup" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Share_reverseShareId_fkey" FOREIGN KEY ("reverseShareId") REFERENCES "ReverseShare" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Share" ("accentColor", "createdAt", "creatorId", "description", "downloads", "editedAt", "expiration", "groupId", "id", "isZipReady", "name", "previewStyle", "removedReason", "reverseShareId", "storageProvider", "uploadLocked", "views", "virusScanCompletedAt", "virusScanError", "virusScanStartedAt", "virusScanStatus", "virusScanThreats") SELECT "accentColor", "createdAt", "creatorId", "description", "downloads", "editedAt", "expiration", "groupId", "id", "isZipReady", "name", "previewStyle", "removedReason", "reverseShareId", "storageProvider", "uploadLocked", "views", "virusScanCompletedAt", "virusScanError", "virusScanStartedAt", "virusScanStatus", "virusScanThreats" FROM "Share";
DROP TABLE "Share";
ALTER TABLE "new_Share" RENAME TO "Share";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
