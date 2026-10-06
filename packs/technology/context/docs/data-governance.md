---
id: DOC-TCH-DATA-GOVERNANCE
title: Customer Data Governance Policy
domain: governance
owner: technology:revenue-steward
version: "1.4"
effective: 2026-04-01
---

# Customer Data Governance Policy

## 1. Purpose

This policy sets how Cobalt Cloud Software governs the customer, revenue, usage and support data used for
reporting and by AI agents: who owns it, how personal data is protected and what agents may and may not do.

## 2. Ownership

Every data product has a named owner, who is accountable for its definitions and contract, and a named steward,
who is accountable for quality, classification and access decisions. Certification of a product and approval of
access requests are human decisions made by the steward and the governance council; agents never make them.

## 3. Personal data

Names, email addresses and phone numbers of customer contacts, and the names of Cobalt sales staff, are personal
data. They are tagged PII at column level and masked for every persona without PII clearance — in Explorer, in
worksheets and in agent answers. Product telemetry is aggregated to tenant-day and account-feature level before
it reaches analytics; individual users' behaviour is never analysed without a recorded consent basis.

## 4. Regional access

Regional sales leaders see only accounts in their own sales region. Company totals and other regions' figures
are not disclosed to them; when they ask for a breakdown by region, they see their own region only.

## 5. Aggregates only

Agents answer with aggregates by region, segment, plan tier, feature, priority or team. Requests for one named
account's contract, usage, contacts or ticket history are declined and redirected to the account team, who can
see the account in the CRM under its own access controls.

## 6. Critical data elements

ARR, the twelve-month-ago ARR used for retention, revenue stream, opportunity amount and type, daily active
users, downtime minutes, first-response minutes and ticket status are critical data elements. Each has
executable data quality rules with a named alert route, and a failing rule degrades the product's health.

## 7. Certification

A data product is certified only when its contract is approved, quality is above threshold, its semantic model
has at least ten verified queries, every sensitive column it exposes is masked and its agents pass evaluation.
Products in certification may be queried by entitled users, and every answer from them is labelled provisional.
