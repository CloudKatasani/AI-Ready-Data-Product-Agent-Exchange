---
id: DOC-TRN-DATA-GOVERNANCE
title: Data Governance Policy for Analytics and AI
domain: drivers-safety
owner: transportation:data-steward
version: "1.1"
effective: 2026-05-01
contains_injection: false
---

# Data Governance Policy for Analytics and AI

## 1. Purpose and scope

This policy sets the rules that make Meridian Freight Lines' data safe and trustworthy for analytics and AI
agents: sensitivity classification, masking, row access, critical data element ownership and the certification of
data products and agents.

## 2. Sensitivity classes

- **PII** — personal information about drivers (names, phone numbers) and shipper logistics contacts (names, emails,
  phone numbers).
- **GOV_ID** — government identifiers such as commercial driver licence numbers, held only in the driver roster.

## 3. Masking and row access

Masking is applied at query time according to the persona's clearance. MASK_PII replaces the value with •••,
MASK_EMAIL hashes the local part of an email, MASK_PHONE shows the last four digits and MASK_GOV_ID the last four
characters. Regional personas see only rows for their own operating region through the RAP_REGION policy.

## 4. Critical data elements

Every critical data element — on-time flag, customer-caused delay flag, dwell hours, revenue, total cost, miles,
claim cost, revenue and available hours, in-service flag, recordable crashes, driver type and region — has a named
owner and steward, at least one executable data quality rule and an approved glossary term.

## 5. Certification

A data product is certified only when its contract is approved, its quality score is 90 or better, it has at least
ten verified queries, every sensitive column it exposes is masked and every agent bound to it has passed evaluation.
Agents draft, profile and critique; only named people approve gates, grant access or certify.

## 6. Agents

Agents answer aggregate questions from certified products and cite the product, version, metric and query behind
every number. They decline requests for individual driver or shipper records, dispatch or pricing changes, claim
decisions and anything that would bypass masking or row access.
