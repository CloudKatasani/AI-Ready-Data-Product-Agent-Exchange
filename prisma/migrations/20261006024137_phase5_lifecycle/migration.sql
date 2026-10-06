-- CreateTable
CREATE TABLE "StageRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "stage" INTEGER NOT NULL,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "state" TEXT NOT NULL,
    "startedAt" DATETIME,
    "completedAt" DATETIME
);

-- CreateTable
CREATE TABLE "Gate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "stage" INTEGER NOT NULL,
    "state" TEXT NOT NULL,
    "quorum" INTEGER NOT NULL,
    "requiredRolesJson" TEXT NOT NULL,
    "vetoRolesJson" TEXT NOT NULL,
    "staleReason" TEXT,
    "submittedBy" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "GateEvidence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gateId" TEXT NOT NULL,
    "artifactVersionId" TEXT NOT NULL,
    "artifactType" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GateEvidence_gateId_fkey" FOREIGN KEY ("gateId") REFERENCES "Gate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Artifact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "stage" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "ArtifactVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "artifactId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "contentJson" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "committedBy" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ArtifactVersion_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "Artifact" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FieldProvenance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "versionId" TEXT NOT NULL,
    "fieldPath" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "agentId" TEXT,
    "acceptedBy" TEXT,
    CONSTRAINT "FieldProvenance_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ArtifactVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "stage" INTEGER NOT NULL,
    "fieldPath" TEXT,
    "authorType" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "parentId" TEXT,
    "resolvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "packId" TEXT NOT NULL,
    "productId" TEXT,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "assigneeRole" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "dueAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ChangeRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "versionBump" TEXT NOT NULL,
    "affectedStagesJson" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "CertificationCheckResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "checkId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "fixApplied" BOOLEAN NOT NULL DEFAULT false,
    "evaluatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AppliedFix" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "packId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "fixId" TEXT NOT NULL,
    "appliedBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AgentAction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "packId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "productId" TEXT,
    "stage" INTEGER,
    "trigger" TEXT NOT NULL,
    "scopeJson" TEXT NOT NULL,
    "inputHash" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "tokensIn" INTEGER NOT NULL DEFAULT 0,
    "tokensOut" INTEGER NOT NULL DEFAULT 0,
    "costUsd" REAL NOT NULL DEFAULT 0,
    "outputJson" TEXT NOT NULL,
    "redactedFieldsJson" TEXT NOT NULL DEFAULT '[]',
    "disposition" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AgentProposal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actionId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "stage" INTEGER NOT NULL,
    "artifactType" TEXT NOT NULL,
    "fieldPath" TEXT NOT NULL,
    "proposedJson" TEXT NOT NULL,
    "acceptedJson" TEXT,
    "rationale" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "decidedBy" TEXT,
    "decidedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AutopilotRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "stepsJson" TEXT NOT NULL,
    "startedBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AgentSetting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "packId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "autonomy" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "ProductRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reference" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "decisionJson" TEXT NOT NULL,
    "questionsJson" TEXT NOT NULL,
    "stakes" TEXT NOT NULL,
    "freshness" TEXT NOT NULL,
    "duplicateCandidatesJson" TEXT NOT NULL,
    "mergedIntoId" TEXT,
    "createdProductId" TEXT,
    "declineReason" TEXT,
    "slaDueAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "StageRun_productId_stage_idx" ON "StageRun"("productId", "stage");

-- CreateIndex
CREATE UNIQUE INDEX "Gate_productId_stage_key" ON "Gate"("productId", "stage");

-- CreateIndex
CREATE INDEX "GateEvidence_gateId_idx" ON "GateEvidence"("gateId");

-- CreateIndex
CREATE UNIQUE INDEX "Artifact_productId_type_key" ON "Artifact"("productId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "ArtifactVersion_artifactId_version_key" ON "ArtifactVersion"("artifactId", "version");

-- CreateIndex
CREATE INDEX "FieldProvenance_versionId_idx" ON "FieldProvenance"("versionId");

-- CreateIndex
CREATE INDEX "Comment_productId_stage_idx" ON "Comment"("productId", "stage");

-- CreateIndex
CREATE INDEX "Task_packId_state_idx" ON "Task"("packId", "state");

-- CreateIndex
CREATE INDEX "CertificationCheckResult_productId_checkId_idx" ON "CertificationCheckResult"("productId", "checkId");

-- CreateIndex
CREATE UNIQUE INDEX "AppliedFix_packId_productId_fixId_key" ON "AppliedFix"("packId", "productId", "fixId");

-- CreateIndex
CREATE INDEX "AgentAction_productId_stage_idx" ON "AgentAction"("productId", "stage");

-- CreateIndex
CREATE INDEX "AgentProposal_productId_state_idx" ON "AgentProposal"("productId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "AgentSetting_packId_agentId_key" ON "AgentSetting"("packId", "agentId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductRequest_reference_key" ON "ProductRequest"("reference");

-- CreateIndex
CREATE INDEX "ProductRequest_packId_state_idx" ON "ProductRequest"("packId", "state");
