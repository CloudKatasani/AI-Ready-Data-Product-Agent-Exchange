---
id: DOC-BNK-DATA-GOVERNANCE
title: Data Governance Policy for Analytics and AI
domain: customer-kyc
owner: banking:data-steward
version: "2.4"
effective: 2026-02-01
contains_injection: false
---

# Data Governance Policy for Analytics and AI

## 1. Scope

This policy applies to every analytical data product, semantic view, dashboard and AI agent at Ridgeline
Bank. It sets the rules for ownership, critical data elements, privacy, access and certification.

## 2. Ownership

Every data product has a named owner accountable for its purpose and contract, and a named steward
accountable for definitions and quality. Every critical data element (CDE) has a glossary term, an owner,
a steward and at least one executable data quality rule before the product exposing it is certified.

## 3. Personal information

Customer names, addresses, emails, phone numbers and dates of birth are nonpublic personal information
(PII); taxpayer identifiers are government identifiers (GOV_ID); card numbers are payment card data (PCI).
These columns are tagged and masked for every persona without the matching clearance, in every surface
including agent answers. Masking is attached by policy, never by hand in a query.

## 4. Row access

Market personas see only rows for their own market. The row access policy RAP_REGION is bound to the
customer and branch dimensions, so every product that reaches customers or branches inherits it. Totals
for other markets are not disclosed.

## 5. Aggregates only for agents

Agents answer with aggregates. Requests for an individual customer's balances, loans, card activity,
alerts or contact details are declined and redirected to the servicing process.

## 6. Decisions stay with people

Agents draft, analyse and explain. They never approve access, certify or publish products, approve or
decline credit, change limits, block cards or file suspicious activity reports.

## 7. Certification

A product is certified at gate 11 when ownership, contract, quality, semantic model, glossary alignment,
governance, lineage and agent readiness checks all pass. A product still in certification may be queried
by entitled personas, but every answer carries a provisional banner.
