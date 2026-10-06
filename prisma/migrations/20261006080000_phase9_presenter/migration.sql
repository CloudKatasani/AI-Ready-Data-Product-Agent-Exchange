-- CreateTable
CREATE TABLE "DemoProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "brandJson" TEXT NOT NULL,
    "termsJson" TEXT NOT NULL,
    "storyId" TEXT,
    "agentMode" TEXT NOT NULL DEFAULT 'scripted',
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" DATETIME,
    "snapshotAt" DATETIME,
    "lastUsedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

