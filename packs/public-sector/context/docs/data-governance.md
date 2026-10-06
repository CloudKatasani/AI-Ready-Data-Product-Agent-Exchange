---
id: DOC-PUB-DATA-GOVERNANCE
title: County Data Governance, Records Retention and Open Data Policy
domain: constituent-services
owner: public-sector:steward
version: "2.2"
effective: 2026-05-11
contains_injection: false
---

# County Data Governance, Records Retention and Open Data Policy

## 1. Purpose and scope

This policy sets the rules that make Westland County's data safe and trustworthy for analytics, open data and AI
agents. It covers lawful basis, sensitivity classification, masking, row access, critical data elements, records
retention, open data and the certification of data products and agents.

## 2. Lawful basis

Constituent data is processed under a recorded lawful basis — the administration of county programs and services —
with a named controller for each data product.

## 3. Sensitivity classes and masking

- **PII** — personal information about constituents, applicants, callers and staff: names, emails, phone numbers,
  street addresses, caseworker, crew lead and buyer names.
- **GOV_ID** — government identifiers captured at intake and vendor tax identifiers.

| Policy | Class | Effect |
|---|---|---|
| **MASK_PII** | PII | Replaces the value with ••• |
| **MASK_EMAIL** | PII | Hashes the local part of an email address |
| **MASK_PHONE** | PII | Shows only the last four digits |
| **MASK_GOV_ID** | GOV_ID | Shows only the last four characters |

Only personas cleared for a class see it unmasked; in practice government identifiers are visible only to the data
steward. Agents never output personal data or identifiers, whatever the clearance of the user asking.

## 4. Row access

The **RAP_DISTRICT** row access policy restricts district-based personas to rows for their own service districts.
A caseworker analyst for North and Central asking for a county figure receives the figure for those districts and is
told that a row filter applied.

## 5. Aggregates only

Agents answer with aggregates. Requests for an individual constituent's case, payments, contact details or
eligibility are declined and redirected to the caseworker process.

## 6. Critical data elements

A **critical data element** (CDE) is a column whose error would change a reported figure: processing days, the
document-hold flag, complete date, pending action, caseworkers, payment and improper amounts, flag status, 311
resolution days and SLA, permit review days, repair days, budget and actual amounts, PO spend and cycle days, grant
drawdown and constituent id. Every CDE has a named owner and steward, a glossary term and at least one executable
data quality rule run daily.

## 7. Records retention

Case files and payment records: seven years after case closure. 311 records: three years. Permit records:
permanently. History in the platform is append-only.

## 8. Open data

Published datasets carry a catalogue record and an open licence, contain aggregates only, and suppress any cell
describing fewer than 11 constituents.

## 9. Certification

A data product is **certified** only after a human decision at the certification gate, supported by automated checks:
masking on every sensitive output column, CDE rules passing, verified queries in place, semantic evaluation above
threshold and a named owner. Agents may draft evidence and propose fixes; they never approve a gate, grant access,
certify or publish.
