---
id: DOC-MFG-OEE-STANDARD
title: OEE Definitions and Loss Standard (OPS-STD-014)
domain: production
owner: manufacturing:ops-dpo
version: "3.2"
effective: 2026-02-09
contains_injection: false
---

# OEE Definitions and Loss Standard (OPS-STD-014)

## 1. Purpose and scope

Overall equipment effectiveness (OEE) measures how much of the planned production time a line spends producing
good units at its ideal cycle time. It is reported per line, plant and business unit every production week, month
and quarter, and it is the number the tier meetings, the capacity plan and the AI agents all use.

## 2. The time base

Every OEE number starts from **planned production time**: the scheduled shift time minus **planned downtime**.
Planned downtime is breaks, planned maintenance and planned changeovers up to the standard changeover time. It is
removed from the time base before availability is measured, so planned downtime is never an OEE loss. Reporting
OEE against the full scheduled time understates it by several points and is not permitted.

## 3. Availability, performance and quality

- **Availability** is run time as a share of planned production time. It is lost to **unplanned downtime**:
  breakdowns, material shortages, changeover overruns, quality holds and operator unavailability.
- **Performance** compares output with the **nameplate ideal cycle time** held on the line master. Minor stops and
  reduced speed show up as performance loss. The average actual cycle time is never used as the ideal.
- **Quality** counts only units good first time. Scrap and rework are both quality losses, even when reworked
  units ship.

OEE = availability × performance × quality, which equals good units × ideal cycle time ÷ planned production time.

## 4. Trial runs

Engineering trials and new-product-introduction (NPI) qualification runs are recorded with run type **Trial**.
They run slowly, stop often and scrap heavily by design. Trial runs are **excluded from OEE, its components, scrap,
rework and first-pass yield** and reported separately to the NPI review, unless a question explicitly asks to
include them. In Q3 2026 Industrial Controls ran trials on about a quarter of its shifts for the new drive and PLC
platform launch, so including trials changes the business-unit ranking.

## 5. Review thresholds

Lines below **65% OEE** for a production week are reviewed at the weekly tier-3 meeting with the dominant loss
(availability, performance or quality) and the top unplanned loss reason. **85%** is the world-class reference,
not the target. Business-unit targets are set annually in the operations plan.

## 6. Loss reasons

Every unplanned stop of five minutes or more carries a reason code: Breakdown, Material shortage, Changeover
overrun, Quality hold or Operator unavailable. The largest unplanned loss of a shift is recorded as its top loss
reason. Stops shorter than the minor-stop threshold are not coded and appear as performance loss.

## 7. Weeks, months and quarters

Production weeks run Monday to Sunday. "Last week" is the most recent complete production week; months and
quarters follow the calendar. Units produced counts good units on every run type.

## 8. Energy

Metered energy is recorded per line shift. Energy per unit divides kWh by good units only, so scrap and rework
raise it.
