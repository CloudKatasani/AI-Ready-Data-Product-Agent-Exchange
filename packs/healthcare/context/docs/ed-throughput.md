---
id: DOC-HC-ED-THROUGHPUT
title: Emergency Department Throughput and Capacity Operations Guide
domain: patient-flow
owner: healthcare:clinical-dpo
version: "1.8"
effective: 2026-02-16
contains_injection: false
---

# Emergency Department Throughput and Capacity Operations Guide

## 1. Purpose

This guide defines the emergency department (ED) throughput measures Crestview uses to manage patient flow,
explains the thresholds that trigger escalation, and describes how ED boarding connects to inpatient capacity.
It applies to all ten hospitals and to the certified Emergency Department Flow data product.

## 2. Timestamps

Every ED visit is recorded on the tracking board with an arrival time, a triage time and acuity, a first provider
contact time, a disposition decision and a departure time. Measures are calculated from these timestamps only;
manual adjustments are not permitted.

## 3. Measures

- **ED visits** — arrivals in the period, including patients who leave without being seen.
- **Door-to-provider time** — minutes from arrival to first contact with a physician or advanced practice
  provider, for patients who are seen. Target: under 30 minutes on average.
- **Left without being seen (LWBS) rate** — arrivals who leave before provider contact, as a share of all
  arrivals. Target: under 3%.
- **ED length of stay** — hours from arrival to departure for every visit.
- **ED admission rate** — admitted visits as a share of arrivals.
- **Boarding time** — hours from the admission decision to departure from the ED, for admitted patients only.

## 4. Triage acuity

Patients are triaged with the Emergency Severity Index (ESI), from ESI 1 (immediate life-saving intervention) to
ESI 5 (non-urgent). Higher-acuity patients are admitted far more often, so admission rate and boarding should
always be compared within acuity levels as well as across facilities.

## 5. Escalation thresholds

- A facility averaging **more than 4 hours of boarding** in a month triggers the capacity escalation plan: the
  house supervisor opens surge beds, expedites discharges before noon and reviews transfers (BR-HC-007).
- An **LWBS rate above 3%** in any month triggers a triage staffing review within 14 days (BR-HC-008).
- Door-to-provider above 45 minutes for three consecutive days triggers provider-in-triage.

## 6. Boarding and inpatient capacity

Boarding is an inpatient capacity problem that shows up in the ED. When inpatient units run above 90% occupancy,
admitted patients wait in ED beds, door-to-provider time rises and more patients leave without being seen.
Riverside Medical Center is the reference case: in the third quarter of 2026 inpatient census ran above staffed
capacity and admitted patients boarded more than twice as long as at other facilities.

## 7. Data use

Throughput measures are reported in aggregate by facility, market, acuity and arrival mode. Individual patient
tracking-board history is clinical information and is available only in the EHR to the care team.
