---
id: DOC-UTL-DATA-GOVERNANCE
title: Data Governance Policy for Analytics and AI
domain: customer
owner: utilities:customer-steward
version: "2.0"
effective: 2026-05-15
contains_injection: false
---

# Data Governance Policy for Analytics and AI

## 1. Purpose and scope

This policy sets the rules that make Northvale Energy's data safe and trustworthy for analytics and AI agents.
It covers sensitivity classification, masking, row access, critical data element ownership and the certification
of data products and agents. It applies to every object in the governed data platform and to every agent that
answers questions from it.

## 2. Sensitivity classes

Columns are classified into sensitivity classes when they enter the curated layer:

- **PII** — personal information about customers, employees or contacts: names, street addresses, emails, phone
  numbers, planner and crew lead names, free-text notes.
- **PCI** — payment card data.
- **GOV_ID** — government or tax identifiers, such as supplier tax ids.

A column that is not classified is treated as unclassified until a steward reviews it; a product cannot be
certified while any of its output columns is unreviewed.

## 3. Masking policies

Masking is applied by the platform at query time to every row-level projection, according to the persona's
clearance. Aggregates such as counts and sums over masked columns remain available.

| Policy | Class | Effect |
|---|---|---|
| **MASK_PII** | PII | Replaces the value with ••• |
| **MASK_EMAIL** | PII | Hashes the local part of an email address |
| **MASK_PHONE** | PII | Shows only the last four digits |
| **MASK_PCI** | PCI | Shows only the last four digits of a card number |
| **MASK_GOV_ID** | GOV_ID | Shows only the last four characters |

Only personas cleared for a class see it unmasked; in practice this is limited to data stewards and the privacy
officer. Agents never output PII, whatever the clearance of the user asking.

## 4. Row access

The **RAP_REGION** row access policy restricts regional personas to the rows for their own service region. It
is bound to the region column of the feeder, customer and premise dimensions and their curated sources, so any
query that touches those objects is filtered automatically. A regional operations manager asking for a system
figure receives the figure for their region and is told that a row filter applied.

## 5. Critical data elements

A **critical data element** (CDE) is a column whose error would materially change a regulated or financial
figure: for example outage duration, customers affected, major event day flag, customers served, billed amount,
amount paid within 60 days, read success, PO spend and on-contract flag, asset health score, span last trim date
and customer number. Every CDE must have:

1. a named owner and steward;
2. a glossary term that defines it;
3. at least one executable data quality rule, run at least daily.

The steward reviews failed rules within one working day and records the outcome.

## 6. Data quality

Quality rules cover six dimensions: completeness, validity, uniqueness, timeliness, consistency and accuracy.
Each product receives a quality score from the rules on its upstream objects. A product must reach the
certification quality threshold before it can pass the certification gate.

## 7. Certification

A data product is **certified** only after a human decision at the certification gate, supported by automated
certification checks: masking attached to every sensitive output column, CDE rules passing, verified queries in
place, semantic evaluation above threshold and a named owner. Agents may draft evidence, profile data and
propose fixes; they never approve a gate, grant access, certify or publish. The governance council requires a
quorum and any member may veto.

## 8. Access requests

Access to a restricted product is requested through the marketplace with a stated purpose. The product owner
or steward approves or declines; the decision, the approver and the purpose are recorded in the audit log.

## 9. Audit

Every query, agent answer, proposal and decision is logged append-only. Logs are retained for seven years.
