-- CreateTable
CREATE TABLE "Persona" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "packId" TEXT NOT NULL,
    "archetype" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "rolesJson" TEXT NOT NULL,
    "rowFilterJson" TEXT,
    "unmaskedJson" TEXT NOT NULL,
    "avatarSeed" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Entitlement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "personaId" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "grantedVia" TEXT NOT NULL,
    "expiresAt" DATETIME,
    "revokedAt" DATETIME
);

-- CreateTable
CREATE TABLE "QueryLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "personaId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "purpose" TEXT,
    "sqlHash" TEXT NOT NULL,
    "displaySql" TEXT NOT NULL,
    "productIdsJson" TEXT NOT NULL,
    "policiesJson" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "elapsedMs" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "packId" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "detailJson" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "prevHash" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "KnowledgeOverlay" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "packId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdBy" TEXT NOT NULL,
    "sourceFeedbackId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supersededAt" DATETIME
);

-- CreateIndex
CREATE INDEX "Persona_packId_idx" ON "Persona"("packId");

-- CreateIndex
CREATE INDEX "Entitlement_personaId_idx" ON "Entitlement"("personaId");

-- CreateIndex
CREATE INDEX "QueryLog_personaId_idx" ON "QueryLog"("personaId");

-- CreateIndex
CREATE INDEX "AuditEvent_packId_idx" ON "AuditEvent"("packId");

-- CreateIndex
CREATE INDEX "KnowledgeOverlay_packId_kind_idx" ON "KnowledgeOverlay"("packId", "kind");
