---
id: DOC-BNK-CARD-FRAUD
title: Card Fraud Operations Standard
domain: cards-payments
owner: banking:lending-dpo
version: "2.2"
effective: 2026-05-01
contains_injection: false
---

# Card Fraud Operations Standard

## 1. Purpose

This standard defines how Ridgeline measures card portfolio performance and fraud, and when fraud
strategy changes are triggered.

## 2. Volume and approval

Purchase volume is the value of approved card authorisations. The authorisation approval rate is approved
authorisations divided by all authorisation requests. Average ticket is the mean approved purchase.

## 3. Fraud loss rate

Fraud losses are approved purchases later **confirmed** as fraud and not recovered. The fraud loss rate is
expressed in basis points of approved volume: fraud losses per 10,000 dollars of purchase volume. Suspected
fraud that is not confirmed is excluded.

## 4. Card-not-present fraud

Card-not-present (CNP) transactions — online and phone orders — carry most fraud losses. When a merchant
category's fraud loss rate exceeds 50 bps for a quarter, it is placed on enhanced CNP authentication.
In Q3 2026 a fraud ring targeting digital-goods merchants pushed that category far above the threshold.

## 5. Decisions

Blocking cards, reissuing cards, changing credit limits and resolving disputes are performed by card
operations staff. Agents explain fraud trends in aggregate and never act on an individual card.

## 6. Card data

Primary account numbers are PCI data. They are held only in the card account table, shown last-four only,
and never appear in facts, products or agent answers.
