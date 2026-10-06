---
id: DOC-TEL-FIELD-SERVICE
title: Field Service Standard
domain: field-operations
owner: telecom:network-dpo
version: "2.1"
effective: 2026-04-01
contains_injection: false
---

# Field Service Standard

## 1. Work order types

Field technicians work four job types: new installs, fiber activations, broadband repairs and network site
repairs. Each work order records whether a truck roll was needed, whether the fault was fixed first time and
whether the appointment window was met.

## 2. First-time fix

A work order is a **first-time fix** when no repeat visit for the same fault happens within 30 days. Only
closed work orders count. The target is 80% for network site repairs and 85% overall. Multi-skilled
technicians fix first time far more often than single-skill crews.

## 3. Truck rolls

A truck roll is any job that needs a technician on site. Remote diagnostics resolve a growing share of
broadband repairs without a truck roll.

## 4. Fiber activation lead time

Fiber activation lead time runs from order to service activation in calendar days, for completed activations
only. The customer promise is ten days; permitting backlogs are the main cause of delays.

## 5. Customer contact data

Technicians see the customer's contact phone and service address in the dispatch tool for the job they are
assigned. Those fields are personal data and must be masked in analytical products for anyone without PII
clearance.
