-- CreateTable
CREATE TABLE "AgentVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "manifestJson" TEXT NOT NULL,
    "manifestHash" TEXT NOT NULL,
    "instructionsHash" TEXT NOT NULL,
    "releaseState" TEXT NOT NULL,
    "canaryPct" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "PublishGateRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentId" TEXT NOT NULL,
    "agentVersion" INTEGER NOT NULL,
    "resultsJson" TEXT NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "EvalRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "packId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "agentVersion" INTEGER NOT NULL,
    "mode" TEXT NOT NULL,
    "suitesJson" TEXT NOT NULL,
    "overall" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "EvalCaseResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "suite" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "expectedJson" TEXT NOT NULL,
    "actualJson" TEXT NOT NULL,
    "pass" BOOLEAN NOT NULL,
    "reason" TEXT,
    CONSTRAINT "EvalCaseResult_runId_fkey" FOREIGN KEY ("runId") REFERENCES "EvalRun" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "AgentVersion_agentId_version_key" ON "AgentVersion"("agentId", "version");

-- CreateIndex
CREATE INDEX "PublishGateRun_agentId_idx" ON "PublishGateRun"("agentId");

-- CreateIndex
CREATE INDEX "EvalRun_agentId_idx" ON "EvalRun"("agentId");

