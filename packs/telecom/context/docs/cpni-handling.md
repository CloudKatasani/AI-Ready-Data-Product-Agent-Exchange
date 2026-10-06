---
id: DOC-TEL-CPNI
title: CPNI Handling Rules
domain: subscriber
owner: telecom:data-steward
version: "5.0"
effective: 2026-03-02
contains_injection: false
---

# CPNI Handling Rules

## 1. What CPNI is

Customer proprietary network information (CPNI) includes the numbers a subscriber calls, call times and
durations, the serving location and the services used. The MSISDN joined to usage is CPNI.

## 2. Who may use it

CPNI may be used internally only by roles cleared by the Privacy Office. All other roles see masked values;
analytics use aggregates. Every access to a CPNI column is logged in the access history.

## 3. Masking

MSISDNs show only their last four digits (MASK_MSISDN). Numbers called and serving cells are redacted
(MASK_CPNI). Any new data product that exposes a CPNI column must attach these policies before certification.

## 4. Agents

Agents never reveal CPNI, never confirm whether a specific person is an Altair subscriber and never describe an
individual's calling pattern or location. Questions about one subscriber are redirected to the care process.

## 5. Lawful process

Lawful process requests are handled in a segregated environment. Analytical products and agents never receive,
reveal or confirm them.
