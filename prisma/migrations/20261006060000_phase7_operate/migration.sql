-- CreateTable
CREATE TABLE "Incident" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "packId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "affectedJson" TEXT NOT NULL,
    "effectsJson" TEXT NOT NULL,
    "openedBy" TEXT NOT NULL,
    "detectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME,
    "resolvedBy" TEXT,
    "postmortemJson" TEXT
);

-- CreateTable
CREATE TABLE "QualityFixRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "packId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "feedbackId" TEXT,
    "overlayId" TEXT NOT NULL,
    "fixType" TEXT NOT NULL,
    "evalBefore" REAL NOT NULL,
    "evalAfter" REAL NOT NULL,
    "appliedBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "Incident_packId_state_idx" ON "Incident"("packId", "state");

-- CreateIndex
CREATE INDEX "QualityFixRun_packId_agentId_idx" ON "QualityFixRun"("packId", "agentId");

