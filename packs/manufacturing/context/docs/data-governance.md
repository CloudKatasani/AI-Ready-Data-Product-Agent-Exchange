---
id: DOC-MFG-DATA-GOVERNANCE
title: Data Governance Policy for Analytics and AI
domain: production
owner: manufacturing:data-steward
version: "2.1"
effective: 2026-05-04
contains_injection: false
---

# Data Governance Policy for Analytics and AI

## 1. Purpose and scope

This policy sets the rules that make Forgepoint's manufacturing data safe and trustworthy for analytics and AI
agents: sensitivity classification, masking, row access, critical data element ownership and certification.

## 2. Sensitivity classes

- **PII** — operator and shift-lead names and emails, injured-person names, distributor order-desk contacts and
  supplier quality contacts.
- **TRADE_SECRET** — controlled process recipes and standard costs from the costed bill of materials.
- **GOV_ID** — supplier tax identifiers.

## 3. Masking

Masking is applied by the platform at query time according to the persona's clearance. MASK_PII replaces the value
with •••, MASK_EMAIL hashes the local part of an email, MASK_PHONE shows the last four digits, MASK_TRADE_SECRET
redacts recipes and costs, and MASK_GOV_ID shows the last four characters. Aggregates over masked columns remain
available. A certified product must have masking attached to every sensitive column it exposes.

## 4. Row access

Business-unit personas see only the business units they support; other business units and company totals are not
disclosed to them. The row access policy RAP_BUSINESS_UNIT is applied on every object that carries a business unit.

## 5. People and performance

Performance analytics attribute losses to lines, reasons and defect codes, not to people. Where a shift lead is
shown, the name is masked for everyone without PII clearance.

## 6. Critical data elements

Every critical data element has a named owner and steward, at least one executable data quality rule and a
glossary term before a product that exposes it can be certified. CDEs include planned production time, unplanned
downtime, good units, run type, ideal cycle time, first-pass result, COPQ, OTIF flags and material status.

## 7. Certification and access

Data products and agents are certified by people at the certification gate; access requests are approved by the
product's steward. Agents explain status and gaps but never approve, certify or publish.
