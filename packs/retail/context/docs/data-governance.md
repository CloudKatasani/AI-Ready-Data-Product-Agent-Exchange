---
id: DOC-RTL-DATA-GOVERNANCE
title: Data Governance Policy for Analytics and AI
domain: customer-loyalty
owner: retail:customer-steward
version: "2.0"
effective: 2026-05-15
contains_injection: false
---

# Data Governance Policy for Analytics and AI

## 1. Purpose and scope

This policy sets the rules that make Harbor & Pine's data safe and trustworthy for analytics and AI agents. It
covers sensitivity classification, masking, row access, critical data element ownership and the certification
of data products and agents.

## 2. Sensitivity classes

- **PII** — personal information about members, employees or vendor contacts: names, street addresses, emails,
  phone numbers, store colleague names, free-text care notes.
- **PCI** — payment card data, held only in tokenised form in the order payment table.
- **GOV_ID** — government or tax identifiers, such as vendor tax ids.

## 3. Masking policies

Masking is applied by the platform at query time according to the persona's clearance. MASK_PII replaces the
value with •••, MASK_EMAIL hashes the local part of an email, MASK_PHONE and MASK_PCI show only the last four
digits, and MASK_GOV_ID shows only the last four characters. Aggregates over masked columns remain available.

## 4. Row access

Regional personas see only rows for their own store region through the RAP_REGION row access policy, bound to
the store and member dimensions. Company totals are not disclosed to them.

## 5. Critical data elements

Every critical data element — net sales, cost, quantity, store region, comparable-store flag, on-hand units,
initial margin, order value, returned value, PO cost and agreed-cost flag among them — has a named owner, a
steward, at least one executable data quality rule and a glossary term before the product exposing it can be
certified.

## 6. Certification

A data product is certified at gate 11 when all eight automated checks pass: ownership, contract, quality,
semantic model (at least ten verified queries), glossary alignment, governance (masking on every exposed
sensitive column), lineage and agent readiness. Agents draft and check; only named humans approve.

## 7. Agents

Agents answer with aggregates only, cite the product, version, metric definition and query behind every number,
and decline requests for individual members' data, approvals or changes to governance.
