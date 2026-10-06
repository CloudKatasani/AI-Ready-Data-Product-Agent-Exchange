---
id: DOC-TEL-NETWORK-SLA
title: Network SLA and Quality of Service Definitions
domain: network-performance
owner: telecom:network-dpo
version: "2026.1"
effective: 2026-01-20
contains_injection: false
---

# Network SLA and Quality of Service Definitions

## 1. Purpose

These definitions govern every network quality figure Altair publishes — to the regulator, the board and the
network operations centre — and every agent answer about network quality.

## 2. Availability

Every cell site must achieve at least **99.9% availability in each calendar month**. Availability is the share
of scheduled site-minutes in service. Downtime counts service-affecting outages; **planned maintenance inside
the approved 00:00–05:00 local window is excluded** unless a report explicitly asks to include it. During
capital programmes the Northeast runs heavy planned maintenance, which is why including it lowers that
region's figure sharply.

## 3. Dropped call rate

Dropped call rate is the number of abnormally released voice calls divided by call attempts, measured from
network counters — never from handset reports. It is compared over whole calendar quarters. The target is
below 0.85% per region per quarter; quarter-over-quarter changes above 0.05 points are reviewed by RAN
engineering.

## 4. Call setup success and throughput

Call setup success rate is the share of call attempts set up successfully. Downlink throughput is the mean
user downlink speed per site-day; 5G carriers deliver roughly twice the LTE figure.

## 5. Fault restoration

A network fault is restored when service returns at the affected site. Mean time to restore counts restored
faults only, from fault raise to restoration. The **restoration SLA is four hours**. Fiber cuts take longest
because splicing crews and permits are needed. Impacted subscriber hours multiply the subscribers affected by
the hours until restoration and are the basis for root-cause priorities.

## 6. Changes

Radio parameter changes, crew scheduling and capital approvals are decided by named engineers and managers.
Analytical products and agents only report on network quality.
