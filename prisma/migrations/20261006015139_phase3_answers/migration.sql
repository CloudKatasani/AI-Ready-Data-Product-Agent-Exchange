-- CreateTable
CREATE TABLE "AnswerRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "packId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "agentVersion" INTEGER NOT NULL DEFAULT 1,
    "personaId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "fallbackReason" TEXT,
    "scenarioId" TEXT,
    "metricQueryJson" TEXT,
    "answerJson" TEXT NOT NULL,
    "citationsJson" TEXT NOT NULL,
    "traceJson" TEXT NOT NULL,
    "confidence" TEXT NOT NULL,
    "tokensIn" INTEGER NOT NULL DEFAULT 0,
    "tokensOut" INTEGER NOT NULL DEFAULT 0,
    "costUsd" REAL NOT NULL DEFAULT 0,
    "latencyMs" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AnswerFeedback" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "answerId" TEXT NOT NULL,
    "personaId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "reason" TEXT,
    "state" TEXT NOT NULL,
    "fixId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "AnswerRecord_packId_agentId_idx" ON "AnswerRecord"("packId", "agentId");

-- CreateIndex
CREATE INDEX "AnswerFeedback_answerId_idx" ON "AnswerFeedback"("answerId");
