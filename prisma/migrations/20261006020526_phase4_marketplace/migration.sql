-- CreateTable
CREATE TABLE "DataProduct" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "packId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "archetype" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "currentStage" INTEGER NOT NULL DEFAULT 1,
    "semanticVersion" TEXT NOT NULL DEFAULT '0.1.0',
    "ownerPersonaId" TEXT NOT NULL,
    "stewardPersonaId" TEXT,
    "description" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "decisionJson" TEXT NOT NULL,
    "sampleQuestionsJson" TEXT NOT NULL,
    "semanticView" TEXT,
    "outputPortsJson" TEXT NOT NULL,
    "slaJson" TEXT NOT NULL,
    "sensitivityJson" TEXT NOT NULL,
    "kpiIdsJson" TEXT NOT NULL,
    "upstreamJson" TEXT NOT NULL,
    "fromPack" BOOLEAN NOT NULL DEFAULT true,
    "isCertDemo" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" DATETIME,
    "retiredAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Agent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "packId" TEXT NOT NULL,
    "family" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT,
    "status" TEXT NOT NULL,
    "ownerPersonaId" TEXT NOT NULL,
    "manifestJson" TEXT NOT NULL,
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "fromPack" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Decision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "packId" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "gateId" TEXT,
    "personaId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AccessRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "packId" TEXT NOT NULL,
    "productId" TEXT,
    "agentId" TEXT,
    "requesterId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "justification" TEXT NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "policyPreviewJson" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AccessRequest_productId_fkey" FOREIGN KEY ("productId") REFERENCES "DataProduct" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DemandItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "packId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "votes" INTEGER NOT NULL DEFAULT 0,
    "state" TEXT NOT NULL,
    "linkedRequestId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "DemandVote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "demandId" TEXT NOT NULL,
    "personaId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "QualityRuleResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "dimension" TEXT NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "observed" REAL,
    "threshold" REAL NOT NULL,
    "evaluatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "QualityScoreSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "score" REAL NOT NULL,
    "dimensionsJson" TEXT NOT NULL,
    "rubricVersion" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QualityScoreSnapshot_productId_fkey" FOREIGN KEY ("productId") REFERENCES "DataProduct" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "DataProduct_packId_idx" ON "DataProduct"("packId");

-- CreateIndex
CREATE INDEX "Agent_packId_idx" ON "Agent"("packId");

-- CreateIndex
CREATE INDEX "Decision_subjectType_subjectId_idx" ON "Decision"("subjectType", "subjectId");

-- CreateIndex
CREATE INDEX "AccessRequest_packId_state_idx" ON "AccessRequest"("packId", "state");

-- CreateIndex
CREATE INDEX "DemandItem_packId_idx" ON "DemandItem"("packId");

-- CreateIndex
CREATE UNIQUE INDEX "DemandVote_demandId_personaId_key" ON "DemandVote"("demandId", "personaId");

-- CreateIndex
CREATE INDEX "QualityRuleResult_productId_idx" ON "QualityRuleResult"("productId");

-- CreateIndex
CREATE INDEX "QualityScoreSnapshot_productId_createdAt_idx" ON "QualityScoreSnapshot"("productId", "createdAt");
