-- CreateTable
CREATE TABLE "ReadinessAssessment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "packId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "answersJson" TEXT NOT NULL,
    "scoresJson" TEXT NOT NULL,
    "band" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "PrioritisationOverride" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "packId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "score" REAL NOT NULL,
    "reason" TEXT NOT NULL,
    "personaId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "ReadinessAssessment_packId_idx" ON "ReadinessAssessment"("packId");

-- CreateIndex
CREATE INDEX "PrioritisationOverride_packId_productId_idx" ON "PrioritisationOverride"("packId", "productId");

