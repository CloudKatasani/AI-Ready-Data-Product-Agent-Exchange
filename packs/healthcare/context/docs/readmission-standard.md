---
id: DOC-HC-READMISSION-STD
title: Readmission and Inpatient Quality Measurement Standard
domain: clinical-quality
owner: healthcare:clinical-dpo
version: "2.4"
effective: 2026-01-05
contains_injection: false
---

# Readmission and Inpatient Quality Measurement Standard

## 1. Purpose and scope

This standard explains how Crestview Health System calculates and reports inpatient quality measures —
30-day readmissions, length of stay, the length of stay index and inpatient mortality — to the quality
committee of the board, to the federal readmissions reduction programme and to internal leadership. Every
figure filed externally or shown on an executive dashboard must be calculated as described here, from the
certified Inpatient Quality & Readmissions data product.

## 2. Index admissions

An **index admission** is a discharged inpatient stay of at least one midnight at any of the ten Crestview
hospitals. Observation stays, emergency department visits and outpatient procedures are never index
admissions. Patients still in house on the reporting date are excluded until they are discharged. Each index
admission is recorded once, against the facility and service line that discharged the patient.

## 3. What counts as a readmission

A **readmission** is an inpatient admission to any Crestview hospital within 30 days of the discharge date of
an index admission. The readmission counts against the index stay, not against the readmitting stay, so a
patient discharged from Riverside Medical Center and readmitted to Riverside North Hospital counts against
Riverside Medical Center.

Discharges with disposition **Expired** are removed from the denominator: a patient who died in hospital cannot
be readmitted. Transfers to another acute hospital are treated as one continuous stay.

## 4. Planned readmissions

Some readmissions are part of the plan of care: staged chemotherapy cycles, the second side of a staged joint
replacement, a scheduled transplant or a planned procedure after a diagnostic admission. The **planned
readmission algorithm** flags these on the readmitting encounter.

Readmission measures exclude index stays followed by a planned readmission unless the user explicitly asks to
include planned readmissions (rule BR-HC-012). Including planned readmissions is useful for capacity planning —
for example, Highland Regional Medical Center stages a large share of its oncology and orthopaedic care — but it
must never be used to compare hospitals on quality, because programmes with more staged care look worse.

## 5. Readmission rate

The **30-day readmission rate** is unplanned readmissions within 30 days divided by live index discharges,
expressed as a percentage to one decimal place. It is reported by facility, market, service line and condition
cohort. Condition cohorts (heart failure, pneumonia, COPD, sepsis, acute myocardial infarction, joint replacement
and stroke) follow the federal measure definitions; every other stay falls in the "All other" cohort.

## 6. Length of stay

**Length of stay** is the number of days from admission to discharge. The **average length of stay** is the mean
across discharges and is reported to two decimals. The **length of stay index** divides observed patient days by
the expected days for the same case mix, using the geometric mean length of stay (GMLOS) assigned to each stay. An
index above 1.0 means patients stay longer than expected; **excess days** are the observed days above GMLOS.
Never average length of stay indices across facilities — recompute from the summed days.

## 7. Inpatient mortality

Inpatient mortality is expired discharges divided by all discharges. It is reported quarterly to the quality
committee and is not risk adjusted in this product; risk-adjusted mortality is produced by the external
benchmarking vendor.

## 8. Review and sign-off

The clinical quality analyst prepares the quarterly readmission report from the certified product. The chief
medical officer reviews it with the clinical data product owner before submission. Any change to these
definitions requires a new version of the data contract and approval at the certification gate.
