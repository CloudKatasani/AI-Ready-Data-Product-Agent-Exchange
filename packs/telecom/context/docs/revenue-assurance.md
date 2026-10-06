---
id: DOC-TEL-REVENUE-ASSURANCE
title: Revenue Assurance and Billing Standard
domain: billing-revenue
owner: telecom:network-dpo
version: "4.3"
effective: 2026-01-12
contains_injection: false
---

# Revenue Assurance and Billing Standard

## 1. Purpose

This standard sets how Altair reconciles rated usage to bills, measures leakage and reports service revenue.

## 2. Rated, billed and leaked

Every usage event is rated by the mediation and rating platform. **Leakage** is rated charges that never reach
an invoice. Leakage is measured at invoice level each bill cycle as leaked amount ÷ rated amount.

## 3. Escalation

A market whose leakage exceeds **0.8% in a quarter** is escalated to revenue assurance with a named root-cause
owner. Mediation changes are the most common cause: a rating rule deployed without a billing mapping leaves
usage rated but unbilled until the mapping is fixed.

## 4. Service revenue and ARPU

Service revenue is billed plan, overage and retail roaming charges net of leakage. Device installments are
billed on the same invoice but are not service revenue and are excluded from ARPU.

## 5. Credits

Billing credits and refunds are approved by care team leaders and revenue assurance analysts; they are never
issued by analytical tools or agents.
