---
id: DOC-GEN-DATA-GOVERNANCE
title: Data Governance Policy
domain: governance
owner: _generic:data-steward
version: "1.1"
effective: 2026-04-01
contains_injection: false
---

# Data Governance Policy

## 1. Purpose and scope

This policy sets out how Acme Holdings governs the data products and agents on its shared data platform: who owns
them, how they are certified, how personal data is protected and how access is granted.

## 2. Ownership

Every data product has a named owner, accountable for its purpose and roadmap, and a named steward, accountable
for its definitions, quality and access decisions. Every metric maps to an approved glossary term. Critical data
elements — the columns a certified number depends on — carry executable data quality rules.

## 3. Certification

A product is certified only after a human governance council approves its certification gate. Automated checks
cover ownership, the data contract, data quality, verified queries, glossary alignment, masking, lineage and agent
readiness. Agents may draft, profile and critique, but **only people approve gates, grant access, certify or
publish**. A product in certification can be queried by its builders and steward; its numbers are provisional.

## 4. Personal data

Employee names and emails, recruiter names, customer contact names, emails and phone numbers and ticket notes are
classified as personal data (PII). They are masked for every persona without PII clearance. Workforce products are
aggregate-only; customer contact details are never released to agents or analytical outputs unless a documented
purpose requires them.

## 5. Access

Access to a data product is requested in the marketplace with a purpose and duration, approved by its steward,
time-limited and reviewed quarterly. Regional personas see only the legal entities and customers in their region.
