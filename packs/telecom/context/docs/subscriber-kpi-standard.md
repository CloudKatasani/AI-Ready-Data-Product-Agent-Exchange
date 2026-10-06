---
id: DOC-TEL-KPI-STANDARD
title: Subscriber KPI Definitions Standard
domain: churn-retention
owner: telecom:retention-analyst
version: "3.2"
effective: 2026-02-09
contains_injection: false
---

# Subscriber KPI Definitions Standard

## 1. Purpose

This standard defines how Altair Communications counts its subscriber base and how it moves: active
subscribers, churn, port-outs, gross adds, net adds, ARPU and usage. One set of definitions applies to the
board pack, the investor KPI sheet, the regulator returns and every dashboard and agent answer.

## 2. Segments and markets

Every line belongs to one segment set by its rate plan: **Postpaid** (monthly bill), **Prepaid** (pay in
advance) or **Broadband** (fiber home internet). Lines are reported in eight markets grouped into four
operating regions — Northeast, Southeast, Central and West.

## 3. Active subscribers

An active subscriber has status Active and is not an inactive prepaid line. A prepaid line with no top-up in
60 days is **inactive**: it still holds a number but nobody is using it. Autopay, tenure, contract and
churn-risk measures are reported over active subscribers only.

## 4. Churn

Churn counts **voluntary disconnects and port-outs**. Plan migrations are excluded: a subscriber who moves from
one rate plan to another stays with Altair and is not churn. Monthly churn is (voluntary disconnects +
port-outs) ÷ opening base, and a quarter's churn is the average of its months.

Inactive prepaid lines are purged automatically after 60 days without a top-up. Those purges are housekeeping,
not a customer decision, so **churn excludes inactive prepaid lines unless a report explicitly asks for them**.
Including them roughly doubles reported prepaid churn and moves the ranking of regions with a large dormant
prepaid tail.

## 5. Involuntary disconnects and net adds

Involuntary disconnects for non-payment or fraud are reported separately from churn. Net adds equal gross adds
minus all disconnects (voluntary, port-out and involuntary); plan migrations net to zero across the base.

## 6. Gross adds and port-outs

Gross adds include port-ins and exclude reactivations within 30 days of a disconnect. A port-out needs a
completed port request; port-out share is port-outs as a share of churn and is the clearest signal of a
competitor's promotion.

## 7. Retention save offers

A save offer is accepted only when the subscriber takes the offer and the line is still active 30 days later.
Save rate is accepted offers divided by offers made. Offers are approved and made by named retention staff.

## 8. ARPU and usage

ARPU is monthly service revenue per billed line. Service revenue includes plan charges, overage and retail
roaming and excludes device installments and one-off fees. Data usage and minutes of use per subscriber count
mobile lines with usage in the month; broadband homes are excluded.

## 9. Thresholds

Postpaid churn above 1.2% in any month, or above 1.0% for a quarter, triggers a retention review with the
regional commercial director. A churn propensity score of 70 or above marks a line as high churn risk.
