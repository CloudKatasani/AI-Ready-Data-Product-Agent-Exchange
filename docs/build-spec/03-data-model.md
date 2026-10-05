# 03 — Data Model

Keystone has **three stores** with clear ownership:

| Store | Holds | Mutability |
|---|---|---|
| **Pack files** (`packs/<id>/`) | Industry *definitions*: company, warehouse generator specs + transforms, semantic views, glossary, context, KPIs, initial products & agents, personas, policies, scenarios, incidents, stories | Read-only at runtime (edited by authors / pack drafter) |
| **App DB** (Prisma; SQLite/Postgres) | *Runtime state*: profiles, products & agents as live records, lifecycle, artifacts, gates, requests, access, answers, feedback, incidents, eval runs, audit, knowledge overlays | Mutable; append-only where stated; snapshotted for reset |
| **Warehouse** (DuckDB per pack) | Synthetic data across 9 schemas + generated governance/registry views | Rebuilt deterministically; DQ results & incident side-effects applied as overlay tables |

Seeding imports pack products/agents into the App DB and **drives them through the real lifecycle
engine** (as ADPM's seed does) so every certified product has genuine gate history.

## 1. Prisma schema (`prisma/schema.prisma`)

JSON columns are `String` with a `Json` suffix and Zod-parsed in repositories (SQLite compatibility);
enums are string unions validated by Zod. IDs: `cuid()` except where a human-readable key is noted.

```prisma
// ───────── Demo & identity ─────────
model DemoProfile {
  id            String   @id @default(cuid())
  name          String
  packId        String
  brandJson     String   // {productName, companyName, logoDataUrl?, primary, accent, font?}
  overridesJson String   // terminology/region overrides
  storyId       String?
  agentMode     String   @default("scripted") // scripted|auto|live
  locked        Boolean  @default(false)
  hiddenDoorsJson String @default("[]")
  snapshotPath  String?
  createdAt     DateTime @default(now())
  lastUsedAt    DateTime?
  archivedAt    DateTime?
}

model Persona {               // imported from pack; one row per pack persona
  id            String @id    // e.g. "utilities:ops-manager-north"
  packId        String
  archetype     String        // A|B|C|D|E
  name          String
  title         String
  domain        String
  rolesJson     String        // Role[]
  rowFilterJson String?       // {dimension, allowed[]}
  unmaskedJson  String        // SensitiveClass[]
  avatarSeed    String
}

// ───────── Catalog: products ─────────
model DataProduct {
  id               String   @id          // "DP-UTL-001" (pack) or generated "DP-UTL-1xx" (studio)
  packId           String
  name             String
  domain           String
  archetype        String                // SOURCE_ALIGNED|AGGREGATE|CONSUMER_ALIGNED|ENTITY_MASTER|…
  tier             String                // bronze-certified|silver|gold|platinum (rubric)
  status           String                // DRAFT|IN_DEVELOPMENT|IN_CERTIFICATION|CERTIFIED|DEPRECATED|RETIRED
  currentStage     Int      @default(1)
  semanticVersion  String   @default("0.1.0")
  ownerPersonaId   String
  stewardPersonaId String?
  description      String
  purpose          String
  decisionJson     String                // consumer persona, decision, cadence, workaround, consequence
  sampleQuestionsJson String
  semanticView     String?
  outputPortsJson  String                // [{kind: sql|semantic|api|agent, ref}]
  slaJson          String                // freshnessMinutes, availabilityPct, maxNullRatePct
  sensitivityJson  String                // SensitiveClass[]
  kpiIdsJson       String
  upstreamJson     String                // FQNs
  fromPack         Boolean  @default(true)
  isCertDemo       Boolean  @default(false) // the product used for the certification moment
  publishedAt      DateTime?
  retiredAt        DateTime?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  stages           StageRun[]
  gates            Gate[]
  artifacts        Artifact[]
  accessRequests   AccessRequest[]
  qualityScores    QualityScoreSnapshot[]
  valueCases       ValueCase[]
  certChecks       CertificationCheckResult[]
}

// ───────── Lifecycle (ported from ADPM) ─────────
model StageRun   { id String @id @default(cuid()); productId String; stage Int; attempt Int @default(1); state String /* NOT_STARTED|IN_PROGRESS|IN_REVIEW|COMPLETE */; startedAt DateTime?; completedAt DateTime?; product DataProduct @relation(fields:[productId], references:[id]) }
model Gate {
  id            String  @id @default(cuid())
  productId     String
  stage         Int
  state         String  // PENDING|IN_REVIEW|APPROVED|REJECTED|STALE
  quorum        Int
  requiredRolesJson String
  vetoRolesJson String
  staleReason   String?
  evidence      GateEvidence[]
  decisions     Decision[]
  product       DataProduct @relation(fields:[productId], references:[id])
}
model GateEvidence { id String @id @default(cuid()); gateId String; artifactVersionId String; contentHash String; gate Gate @relation(fields:[gateId], references:[id]) }
model Decision {                         // ONLY written by recordDecision()
  id         String   @id @default(cuid())
  subjectType String  // GATE|ACCESS_REQUEST|AGENT_PUBLISH|PRODUCT_CERTIFY|TRIAGE
  subjectId  String
  gateId     String?
  personaId  String
  role       String
  outcome    String   // APPROVE|REJECT|VETO
  rationale  String
  createdAt  DateTime @default(now())
  gate       Gate?    @relation(fields:[gateId], references:[id])
}
model Artifact { id String @id @default(cuid()); productId String; type String /* registry key */; stage Int; versions ArtifactVersion[]; product DataProduct @relation(fields:[productId], references:[id]); @@unique([productId, type]) }
model ArtifactVersion {                  // append-only, content-hashed
  id          String   @id @default(cuid())
  artifactId  String
  version     Int
  contentJson String
  contentHash String
  committedBy String   // personaId
  message     String
  createdAt   DateTime @default(now())
  provenance  FieldProvenance[]
  artifact    Artifact @relation(fields:[artifactId], references:[id])
}
model FieldProvenance { id String @id @default(cuid()); versionId String; fieldPath String; source String /* HUMAN|AGENT */; agentId String?; acceptedBy String?; version ArtifactVersion @relation(fields:[versionId], references:[id]) }
model Comment { id String @id @default(cuid()); productId String; stage Int; fieldPath String?; authorType String; authorId String; body String; parentId String?; resolvedAt DateTime?; createdAt DateTime @default(now()) }
model Task { id String @id @default(cuid()); productId String?; kind String; title String; assigneeRole String; state String; dueAt DateTime?; createdAt DateTime @default(now()) }
model ChangeRequest { id String @id @default(cuid()); productId String; severity String; versionBump String; affectedStagesJson String; description String; state String; createdAt DateTime @default(now()) }
model CertificationCheckResult { id String @id @default(cuid()); productId String; checkId String; status String /* pass|warn|fail */; detail String; fixApplied Boolean @default(false); evaluatedAt DateTime @default(now()); product DataProduct @relation(fields:[productId], references:[id]) }

// ───────── Agents ─────────
model Agent {
  id             String  @id           // "AG-UTL-001" or factory-generated
  packId         String
  family         String                // DOMAIN|LIFECYCLE|PLATFORM
  name           String
  domain         String?
  status         String                // DRAFT|PILOT|CANARY|PRODUCTION|RETIRED
  ownerPersonaId String
  manifestJson   String                // full domain-agent manifest (see 08-agents-llm.md)
  currentVersion Int     @default(1)
  fromPack       Boolean @default(true)
  createdAt      DateTime @default(now())
  versions       AgentVersion[]
}
model AgentVersion { id String @id @default(cuid()); agentId String; version Int; manifestJson String; manifestHash String; instructionsHash String; releaseState String /* candidate|canary|live|rolled_back */; canaryPct Int @default(0); createdAt DateTime @default(now()); agent Agent @relation(fields:[agentId], references:[id]) }
model PublishGateRun { id String @id @default(cuid()); agentId String; agentVersion Int; resultsJson String; passed Boolean; createdAt DateTime @default(now()) }
model EvalRun { id String @id @default(cuid()); agentId String; agentVersion Int; mode String; suitesJson String /* per suite score, n, threshold */; overall Float; createdAt DateTime @default(now()); cases EvalCaseResult[] }
model EvalCaseResult { id String @id @default(cuid()); runId String; suite String; caseId String; question String; expectedJson String; actualJson String; pass Boolean; reason String?; run EvalRun @relation(fields:[runId], references:[id]) }

// ───────── Answers & feedback (append-only) ─────────
model AnswerRecord {
  id          String   @id @default(cuid())
  agentId     String
  agentVersion Int
  personaId   String
  question    String
  kind        String   // answer|decline|clarify|redirect|help
  mode        String   // scripted|live|live_fallback
  fallbackReason String?
  scenarioId  String?
  metricQueryJson String?
  answerJson  String   // full AgentAnswer
  citationsJson String
  traceJson   String
  confidence  String   // trusted|questionable|unsafe
  tokensIn    Int      @default(0)
  tokensOut   Int      @default(0)
  costUsd     Float    @default(0)
  latencyMs   Int
  createdAt   DateTime @default(now())
}
model AnswerFeedback { id String @id @default(cuid()); answerId String; personaId String; rating Int; reason String?; state String /* NEW|TRIAGED|FIXED|DISMISSED */; fixId String?; createdAt DateTime @default(now()) }

// ───────── Knowledge overlays (agent-quality fixes, steward edits) ─────────
model KnowledgeOverlay {
  id        String  @id @default(cuid())
  packId    String
  kind      String  // SYNONYM|BUSINESS_RULE|VERIFIED_QUERY|INSTRUCTION|GLOSSARY_TERM
  key       String  // e.g. BR-021
  payloadJson String
  version   Int     @default(1)
  createdBy String
  sourceFeedbackId String?
  createdAt DateTime @default(now())
  supersededAt DateTime?
}

// ───────── Lifecycle agents (ported) ─────────
model AgentAction { id String @id @default(cuid()); agentId String; productId String?; stage Int?; trigger String; scopeJson String; inputHash String; model String; provider String /* anthropic|heuristic */; tokensIn Int; tokensOut Int; costUsd Float; outputJson String; redactedFieldsJson String; disposition String; createdAt DateTime @default(now()) }
model AgentProposal { id String @id @default(cuid()); actionId String; productId String; artifactType String; fieldPath String; proposedJson String; acceptedJson String?; rationale String; state String /* OPEN|ACCEPTED|EDITED|REJECTED */; decidedBy String?; decidedAt DateTime? }
model AutopilotRun { id String @id @default(cuid()); productId String; mode String; state String /* RUNNING|AWAITING_REVIEW|AWAITING_GATE|COMPLETED|CANCELLED */; stepsJson String; startedBy String; createdAt DateTime @default(now()) }
model AgentSetting { id String @id @default(cuid()); packId String; agentId String; autonomy String /* L0|L1|L2|L3 */; @@unique([packId, agentId]) }

// ───────── Demand & access ─────────
model ProductRequest { id String @id @default(cuid()); reference String @unique; packId String; requesterId String; state String /* SUBMITTED|TRIAGE|APPROVED|MERGED|DECLINED */; decisionJson String; questionsJson String; stakes String; freshness String; duplicateCandidatesJson String; mergedIntoId String?; createdProductId String?; slaDueAt DateTime; createdAt DateTime @default(now()) }
model DemandItem { id String @id @default(cuid()); packId String; kind String /* PRODUCT|AGENT|KPI */; title String; description String; votes Int @default(0); state String; linkedRequestId String?; createdBy String; createdAt DateTime @default(now()) }
model AccessRequest { id String @id @default(cuid()); productId String?; agentId String?; requesterId String; purpose String; justification String; durationDays Int; policyPreviewJson String; state String /* PENDING|GRANTED|DENIED|EXPIRED|REVOKED */; createdAt DateTime @default(now()); product DataProduct? @relation(fields:[productId], references:[id]) }
model Entitlement { id String @id @default(cuid()); personaId String; subjectType String; subjectId String; purpose String; grantedVia String /* SEED|REQUEST */; expiresAt DateTime?; revokedAt DateTime? }

// ───────── Quality, health, incidents ─────────
model QualityRuleResult { id String @id @default(cuid()); productId String; ruleId String; dimension String; passed Boolean; observed Float; threshold Float; evaluatedAt DateTime @default(now()) }
model QualityScoreSnapshot { id String @id @default(cuid()); productId String; score Float; dimensionsJson String; rubricVersion String; createdAt DateTime @default(now()); product DataProduct @relation(fields:[productId], references:[id]) }
model Incident { id String @id @default(cuid()); packId String; templateId String; title String; severity String; state String /* OPEN|MITIGATED|RESOLVED */; affectedJson String /* objects, products, agents */; effectsJson String; detectedAt DateTime; resolvedAt DateTime?; postmortemJson String? }

// ───────── Value, portfolio, strategy ─────────
model ValueCase { id String @id @default(cuid()); productId String; hypothesis String; baseline Float; target Float; unit String; assumptionsJson String; measurementsJson String; state String; product DataProduct @relation(fields:[productId], references:[id]) }
model PrioritisationOverride { id String @id @default(cuid()); productId String; model String; score Float; reason String; personaId String; createdAt DateTime @default(now()) }
model ReadinessAssessment { id String @id @default(cuid()); packId String; name String; answersJson String; scoresJson String; band String; createdAt DateTime @default(now()) }
model MaturityAssessment { id String @id @default(cuid()); packId String; dimensionsJson String; createdAt DateTime @default(now()) }

// ───────── Telemetry & audit (append-only) ─────────
model QueryLog { id String @id @default(cuid()); personaId String; kind String; purpose String?; sqlHash String; displaySql String; productIdsJson String; policiesJson String; rowCount Int; elapsedMs Int; createdAt DateTime @default(now()) }
model AuditEvent { id String @id @default(cuid()); packId String; actorType String /* HUMAN|AGENT|SYSTEM */; actorId String; action String; subjectType String; subjectId String; detailJson String; hash String; prevHash String?; createdAt DateTime @default(now()) }
```

`AuditEvent.hash = sha256(prevHash + canonicalJson(event))` — hash chain verified by the audit export.

## 2. Warehouse layout (DuckDB, per pack)

Database file `data/warehouse/<pack>.duckdb`; logical database name from pack (e.g. `NVE_AI_PLATFORM`).
DuckDB schemas mirror the nine layers:

| Schema | Content | Built by |
|---|---|---|
| `RAW_BRONZE` | Source-shaped tables with CDC noise (`_op` U/D duplicates, untrimmed/mixed-case strings, late records), `_loaded_at` | Generator (`04` §5) |
| `CURATED_SILVER` | Typed, deduplicated, conformed tables | Pack SQL `warehouse/silver/*.sql` |
| `CONFORMED_GOLD` | Star schemas: facts + dimensions | Pack SQL `warehouse/gold/*.sql` |
| `SEMANTIC` | Views materialising each semantic view's base join (for Explorer display) | Generated from semantic YAML |
| `GLOSSARY` | `TERMS`, `TERM_MAPPINGS` | Generated from pack + overlays |
| `CONTEXT` | `BUSINESS_RULES`, `VERIFIED_QUERIES`, `SYNONYMS`, `INSTRUCTIONS`, `DOCUMENTS`, `DOCUMENT_CHUNKS` | Generated |
| `DATA_PRODUCTS` | Output-port views per product (`DP_UTL_001_*`), `DP_REGISTRY` | Generated (registry is a view over an app-DB sync table) |
| `AGENTS` | `AGENT_REGISTRY`, `AGENT_EVAL_RESULTS` | Generated |
| `GOVERNANCE` | `TAGS`, `MASKING_POLICIES`, `ROW_ACCESS_POLICIES`, `GRANTS`, `DQ_RESULTS`, `ACCESS_HISTORY` | Generated + synced |

Registry/governance tables that reflect live app state are refreshed by `warehouse/sync.ts` after
relevant mutations (certify, publish, grant, incident, DQ run), so Explorer always shows truth.

## 3. Key derived values

| Value | Formula | Source of thresholds |
|---|---|---|
| Quality score (0–100) | Σ(dimension weight × pass rate) over 6 dimensions (completeness, validity, uniqueness, timeliness, consistency, accuracy) | `rubrics.yaml#quality` |
| Freshness status | `now(asOf) - max(_loaded_at)` vs SLA freshness | product SLA |
| Confidence (answer) | `trusted` if all sources certified + healthy + no masking ambiguity; `questionable` if any degraded/in-certification; `unsafe` if governance knocked out or uncertified with sensitive columns | `rubrics.yaml#confidence` |
| Readiness | Ported verbatim (`00` §5.1) | `strategy/readiness.ts` |
| Coverage level 0–6 | Ported; reads lifecycle stage + certification + agent status from DB | `strategy/coverage.ts` |
| Agent eval overall | Weighted suite scores; each suite has its own threshold | `rubrics.yaml#agentEval` |
| WSJF | (business value + time criticality + risk reduction + reuse) / effort | `rubrics.yaml#prioritisation` |
