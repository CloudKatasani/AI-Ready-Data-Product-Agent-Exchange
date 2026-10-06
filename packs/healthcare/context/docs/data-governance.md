---
id: DOC-HC-DATA-GOVERNANCE
title: Data Governance and Health Information Privacy Policy for Analytics and AI
domain: patient-access
owner: healthcare:his-steward
version: "2.1"
effective: 2026-05-11
contains_injection: false
---

# Data Governance and Health Information Privacy Policy for Analytics and AI

## 1. Purpose and scope

This policy sets the rules that make Crestview Health System's data safe and trustworthy for analytics and AI agents.
It covers sensitivity classification, masking, row access, critical data element ownership and the certification of
data products and agents, and applies the privacy rule's minimum necessary standard to every query.

## 2. Sensitivity classes

Columns are classified when they enter the curated layer:

- **PHI** — protected health information: patient names, dates of birth, medical record numbers, addresses, emails,
  phone numbers and free-text comments or narratives linked to a patient.
- **PII** — personal information about clinicians, staff, buyers and supplier contacts.
- **GOV_ID** — government or tax identifiers: social security numbers and payer or supplier tax ids.

A column that is not classified is treated as unclassified until a steward reviews it; a product cannot be certified
while any of its output columns is unreviewed.

## 3. Masking policies

Masking is applied by the platform at query time to every row-level projection, according to the persona's clearance.
Aggregates such as counts and averages over masked columns remain available.

| Policy | Class | Effect |
|---|---|---|
| **MASK_PHI** | PHI | Replaces the value with [redacted] |
| **MASK_PII** | PII | Replaces the value with ••• |
| **MASK_EMAIL** | PII | Hashes the local part of an email address |
| **MASK_PHONE** | PII | Shows only the last four digits |
| **MASK_GOV_ID** | GOV_ID | Shows only the last four characters |

Only personas cleared for a class see it unmasked; in practice this is limited to the health information data steward
and the privacy officer. Agents never output PHI, whatever the clearance of the user asking.

## 4. Row access

The **RAP_REGION** row access policy restricts market personas to the rows for their own market. It is bound to the
region column of the facility, care unit and patient dimensions and their curated sources, so any query that touches
those objects is filtered automatically. A market operations director asking for a system figure receives the figure
for their market and is told that a row filter applied.

## 5. Critical data elements

A **critical data element** (CDE) is a column whose error would materially change a regulated quality measure or a
financial figure: for example the readmission and planned readmission flags, length of stay, discharge disposition,
door-to-provider time, LWBS flag, expected reimbursement, payments within 60 days, denial flag, appointment status,
supply spend and on-contract flag, unit census and nursing hours, facility market and medical record number. Every CDE
must have a named owner and steward, a glossary term and at least one executable data quality rule, run at least daily.

## 6. Data quality

Quality rules cover six dimensions: completeness, validity, uniqueness, timeliness, consistency and accuracy. Each
product receives a quality score from the rules on its upstream objects and must reach the certification threshold
before it can pass the certification gate.

## 7. Certification

A data product is **certified** only after a human decision at the certification gate, supported by automated checks:
masking attached to every sensitive output column, CDE rules passing, verified queries in place, semantic evaluation
above threshold and a named owner. Agents may draft evidence, profile data and propose fixes; they never approve a
gate, grant access, certify or publish. The governance council requires a quorum and any member may veto.

## 8. Access requests and release of information

Access to a restricted product is requested through the marketplace with a stated purpose; the steward or privacy
officer decides. Requests for an individual patient's record go to health information management's release-of-
information process, never to analytics or agents.

## 9. Audit

Every query, agent answer, proposal and decision is logged append-only. Logs are retained for ten years.
