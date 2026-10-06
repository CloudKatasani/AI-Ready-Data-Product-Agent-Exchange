---
id: DOC-MFG-MAINTENANCE-STANDARD
title: Maintenance Standard MS-201 — Reliability and Planned Maintenance
domain: maintenance
owner: manufacturing:ops-dpo
version: "2.3"
effective: 2025-12-15
contains_injection: false
---

# Maintenance Standard MS-201 — Reliability and Planned Maintenance

## 1. Purpose

This standard defines how Forgepoint plans maintenance and measures asset reliability across all plants.

## 2. Work order types

- **Preventive** work orders are raised from a calendar schedule or a condition trigger, such as IoT vibration and
  temperature alarms. They are planned maintenance.
- **Corrective** work orders are raised when an asset fails in service. Only corrective work orders count as
  failures.

## 3. MTBF and MTTR

**MTBF** (mean time between failures) is the average operating hours an asset ran between failures: the run hours
recorded on each corrective work order since the asset's previous failure, averaged over failures. **MTTR** (mean
time to repair) is the repair hours on corrective work orders divided by failures, measured from the failure until
the asset is returned to production, including time spent waiting for spares.

## 4. Planned maintenance targets

At least **80%** of maintenance work orders should be planned. **PM schedule compliance** is the share of preventive
work orders completed by their scheduled date; the target is 85%.

## 5. Criticality and reliability reviews

Assets are ranked criticality **A** (no redundancy — a failure stops the line), **B** (important) or **C**
(standard). A criticality A asset with MTBF below **150 hours** in a quarter enters a reliability review and a
spare-parts check with the Maintenance Planner. In Q3 2026 asset AS-0042, a CNC machine on a Motion Systems line,
failed repeatedly with spindle faults and entered review.

## 6. Maintenance cost

Maintenance cost is labour at the standard technician rate plus parts on every work order. Aerospace repairs use
specialist technicians and long-lead spares and take longer.

## 7. Boundaries

Raising, scheduling and closing work orders happens in the EAM system and is done by planners and technicians.
Agents report reliability; they never change a work order or a stocking policy.
