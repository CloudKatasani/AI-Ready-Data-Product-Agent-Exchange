/**
 * Capability maturity (01 §M11 Portfolio) — dimensions, levels and next moves ported from ADPM
 * `portfolio/maturity.ts`. Keystone derives each level from evidence in the live estate rather than a
 * self-assessment, so the number moves when the estate does (ADR-0020).
 */
export interface MaturityDimension {
  key: string;
  name: string;
  question: string;
  levels: [string, string, string, string, string];
  nextMoves: [string, string, string];
}

export const MATURITY_DIMENSIONS: MaturityDimension[] = [
  {
    key: "consumption-orientation",
    name: "Consumption orientation",
    question:
      "How reliably does work start from a named consumer and a blocked decision?",
    levels: [
      "Work starts from source systems and platform projects.",
      "Some products name a consumer, usually after the build began.",
      "Most products start from a decision, but the questions are vague.",
      "Every product starts from a named consumer, decision and questions.",
      "Metrics trace to consumer questions automatically, and untraced metrics are rejected.",
    ],
    nextMoves: [
      'Require a named consumer role on every intake, and reject "the business".',
      "Make the decision register a hard block on Stage 2.",
      "Trace every certified metric to a recorded question and report the exceptions.",
    ],
  },
  {
    key: "lifecycle-discipline",
    name: "Lifecycle discipline",
    question:
      "How consistently do products pass through defined stages and gates?",
    levels: [
      "No defined lifecycle; delivery is ad hoc.",
      "A lifecycle exists on a slide but is not enforced.",
      "Stages are followed for major products only.",
      "Every product passes gates with recorded approvals.",
      "Gate cycle time, rework and first-time pass rate are measured and improving.",
    ],
    nextMoves: [
      "Enforce gates in the tool rather than in the process document.",
      "Measure rework loops per stage and address the worst two.",
      "Publish first-time certification pass rate to the steering committee.",
    ],
  },
  {
    key: "semantic-consistency",
    name: "Semantic consistency",
    question:
      "How consistently does one metric mean one thing across channels?",
    levels: [
      "Every report defines its own numbers.",
      "A glossary exists but is not enforced anywhere.",
      "A semantic layer exists for some domains.",
      "Certified metrics are unique workspace-wide and enforced at the gate.",
      "Every channel — BI, self-serve, conversational, agentic, API — reads the same definition.",
    ],
    nextMoves: [
      "Enforce workspace-unique metric names at Stage 6.",
      "Migrate the top ten reported metrics into the semantic layer.",
      "Point the conversational and agentic channels at the semantic layer only.",
    ],
  },
  {
    key: "governance-trust",
    name: "Governance and trust",
    question: "Is trust demonstrated with evidence, or asserted with a badge?",
    levels: [
      "No classification or certification.",
      "Classification exists at table level and is often stale.",
      "Attribute-level classification for new products.",
      "Certification cites artifact versions and approvals.",
      "Approvals decay automatically when their evidence changes, and re-approval is tracked.",
    ],
    nextMoves: [
      "Block Stage 9 until every attribute carries a classification.",
      "Require a resolving citation for every certification dimension.",
      "Report stale approvals as a standing governance metric.",
    ],
  },
  {
    key: "platform-automation",
    name: "Platform and automation",
    question:
      "How much of the mechanical work is automated, and how much is retyped?",
    levels: [
      "Everything is manual and stored in documents.",
      "Some templates exist; lineage is drawn by hand.",
      "Profiling and lineage are generated for new products.",
      "Agents draft, profile, critique and monitor with human disposition.",
      "Agent proposal acceptance rate and time saved are measured and acted on.",
    ],
    nextMoves: [
      "Turn on the Profiling and Definition agents at L1 for one domain.",
      "Generate lineage and ER diagrams rather than drawing them.",
      "Report agent acceptance and edit rates monthly.",
    ],
  },
  {
    key: "operating-model-adoption",
    name: "Operating model and adoption",
    question:
      "Are roles, prioritisation and value realisation actually operating?",
    levels: [
      "No defined roles; delivery is project-funded and one-off.",
      "Roles named on a slide; prioritisation is by loudest voice.",
      "Roles assigned per domain; a scoring model exists.",
      "Prioritisation is scored, overridable with a reason, and followed.",
      "Value realisation is measured per product and rolled up to the portfolio.",
    ],
    nextMoves: [
      "Assign a named product owner and steward per domain.",
      "Adopt a scoring model and record every override reason.",
      "Measure the Stage 2 hypothesis for every product that reached its measurement date.",
    ],
  },
];

export function maturityLevelLabel(level: number): string {
  return (
    ["Absent", "Initial", "Developing", "Defined", "Managed", "Optimising"][
      level
    ] ?? "Unknown"
  );
}

/** Evidence the levels are derived from (each a share 0–1 of the relevant population). */
export interface MaturityFacts {
  /** Products that name a consumer persona, a decision and ≥ 3 questions. */
  consumption: number;
  /** Products whose every passed stage has an approved gate with a recorded human decision. */
  lifecycle: number;
  /** KPIs whose metric lives in a semantic view and has ≥ 1 active verified query. */
  semantic: number;
  /** Certified products whose latest certification checks all pass. */
  governance: number;
  /** Agent proposals accepted or edited by a human (of all disposed proposals). */
  automation: number;
  /** Value cases with a measured value. */
  operating: number;
}

const KEY_FACT: Record<string, keyof MaturityFacts> = {
  "consumption-orientation": "consumption",
  "lifecycle-discipline": "lifecycle",
  "semantic-consistency": "semantic",
  "governance-trust": "governance",
  "platform-automation": "automation",
  "operating-model-adoption": "operating",
};

/** Level 1–5 from a share: 1 + round(share × 4). */
export const levelFromShare = (share: number) =>
  Math.min(5, Math.max(1, 1 + Math.round(Math.max(0, Math.min(1, share)) * 4)));

export function maturityFromFacts(
  facts: MaturityFacts,
): {
  key: string;
  name: string;
  level: number;
  evidence: number;
  description: string;
  nextMove: string;
}[] {
  return MATURITY_DIMENSIONS.map((d) => {
    const share = facts[KEY_FACT[d.key] ?? "consumption"];
    const level = levelFromShare(share);
    return {
      key: d.key,
      name: d.name,
      level,
      evidence: Math.round(share * 1000) / 10,
      description: d.levels[level - 1] ?? "",
      nextMove:
        d.nextMoves[Math.min(2, Math.max(0, level - 3))] ?? d.nextMoves[0],
    };
  });
}

export function overallMaturity(levels: { level: number }[]): number {
  return levels.length
    ? Math.round(
        (levels.reduce((a, l) => a + l.level, 0) / levels.length) * 10,
      ) / 10
    : 0;
}
