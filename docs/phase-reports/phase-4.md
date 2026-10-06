# Phase 4 — Marketplace & access

Status: **complete**. Date: 2026-10-06. Phase 5 follows straight on, as instructed.

## Built

| Deliverable | Where |
|---|---|
| Prisma models **DataProduct, Agent, Decision, AccessRequest, DemandItem, DemandVote, QualityRuleResult, QualityScoreSnapshot**, with migration | `prisma/schema.prisma`, `prisma/migrations/*phase4*` |
| **Seed** writes product and agent records with their pack status (the temporary `seedStatus` path; Phase 5 replaces it with lifecycle-driven seeding), demand items, and a quality snapshot per product computed by the **real DQ engine** through QueryService (`purpose: dq-rule`). `pnpm demo` now builds the warehouse before seeding | `src/lib/presenter/seed.ts`, `scripts/seed.ts` |
| **DQ engine**: declared rules run as governed SQL. Scores use row-level pass rates per dimension (1 − null/dup/invalid rate, regex conformance; assertions otherwise) weighted by `rubrics.quality`, with tiers from the rubric | `src/lib/lifecycle/quality.ts` |
| **`recordDecision()`**, the only approval path. It refuses agents; requires a human holding a required role who is not the requester; covers every required role before GRANTED. Policy auto-approval is a SYSTEM decision naming `POLICY_AUTO_APPROVE_INTERNAL`. Runs in one transaction, writes the entitlement (expiry on the pack clock), and is hash-chain audited | `src/lib/lifecycle/decisions.ts` |
| **Access workflow**: policy preview (auto-approve eligibility, required approver roles and personas, columns that stay masked, the row filter that will apply, policies, reasons), submit, approver inbox, my requests. Purposes, durations and approver roles live in `rubrics.access` | `src/lib/marketplace/access.ts`, `packs/_shared/rubrics.yaml` |
| **Catalog** cards (quality ring, status, version, sensitivity, consumers, agents, KPIs, patterns, freshness SLA, access badge: Granted / Pending / Requestable / Restricted) and facets (domain, status, tier, KPI, sensitivity, consumption, owner, accessible to me, has agent) | `src/lib/marketplace/catalog.ts` |
| **Search**: MiniSearch BM25 over products, agents and KPIs. Each document carries KPI names, metric synonyms and glossary terms, plus synonym query expansion | `src/lib/marketplace/search.ts` |
| **Mesh**: data mesh (shared upstream/semantic tables) and agent mesh (shared KPIs, product feeds). **Blast radius** works from a product, a warehouse object or an agent | `src/lib/marketplace/mesh.ts` |
| **Demand board**: one vote per persona, submit with a TF-IDF duplicate check against products, agents and open demand | `src/lib/marketplace/demand.ts` |
| **KPI coverage**: "Can I answer it?" with reason (via agent / needs product) | `src/lib/marketplace/coverage.ts` |
| **ODCS v3 data contract** export (schema with classification, masking, CDE, business names; quality rules; SLA; team; servers) and `GET /api/contract` | `src/lib/standards/odcs.ts`, `src/app/api/contract` |
| **Marketplace screen**: search, facets, product and agent cards, KPI hits, compare (up to 3), demand board, data and agent mesh graphs with blast-radius highlight plus a keyboard node list | `src/app/[pack]/(consumer)/marketplace`, `src/components/marketplace/*` |
| **Product detail**: Overview (purpose, decision record, sample questions that link to Ask), Contract (ODCS YAML + download), Schema (types, tags, glossary links, masking for you), Quality (ring, dimensions, rule results), Lineage, Semantic, Consumption, Agents, Value, History. Includes the **Request access drawer** with a live policy preview | `…/marketplace/products/[id]` |
| **Agent detail**: Overview, Coverage map (KPI × grain matrix, slices, depth), Products & tools, Instructions, Evaluation (thresholds; runs arrive in Phase 6), Release, Usage & cost, Try it (embedded Ask console) | `…/marketplace/agents/[id]` |
| **My Access**: approvals inbox (approve/deny with rationale through `recordDecision`), my products with expiry, my agents, my requests, KPI coverage matrix. Home's "open items" now shows waiting approvals and pending requests | `src/app/[pack]/(consumer)/access`, Home |
| ADR-0016: platform vocabulary ("contract") is exempt from the domain-string lint | `docs/adr/0016-platform-vocabulary-lint.md` |

## Definition of Done

| Check | Result |
|---|---|
| **AC3.1**: persona A sees Restricted; requests; D approves; A sees Granted and the agent answers | ✅ integration `access.test.ts` (engine and recordDecision: decline before, answer after, entitlement expiry, audit) and e2e `marketplace.spec.ts` (full UI flow across persona switches) |
| **AC3.2**: "outage minutes" returns the reliability product and the SAIDI KPI via synonym | ✅ integration (plus three more phrasings) and e2e |
| **AC3.3**: quality ring = latest QualityScoreSnapshot | ✅ integration (including a newly written snapshot) and e2e (card ring = product page ring) |
| Invariant **I04** for access requests | ✅ source scan: only `decisions.ts` writes Decision rows, assigns GRANTED, updates AccessRequest or grants by request. Behaviour: agent, requester, role-less persona and bogus SYSTEM decisions are refused; a denied request can't be re-decided |

Totals: `pnpm test` gives 23 files, 299 tests passing (22 `todo`). The tests now run against a dedicated test app DB (`data/test-app.db`) that is created fresh, migrated and seeded on every run. `pnpm test:e2e`: 125 passing (all new marketplace, product, agent and My Access URLs pass axe WCAG 2.2 AA). `pnpm pack:validate utilities`: 4,292 checks, 0 errors. Golden: 0 differences. Typecheck, lint, domain-string lint and build are clean.

## Notes
- The seeded quality scores are genuine. Utilities data is clean, so most products score 99–100; incidents (Phase 7) and the certification demo (Phase 5) move them.
- Test setup no longer uses `prisma migrate reset`. It deletes its own throwaway DB file and runs `migrate deploy`.
- Chips keep their text in the foreground colour and carry status colour on the border, dot or icon, so they meet contrast in both themes.
