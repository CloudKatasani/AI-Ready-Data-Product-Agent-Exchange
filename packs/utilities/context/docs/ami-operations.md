---
id: DOC-UTL-AMI-OPERATIONS
title: AMI Metering Operations Guide
domain: metering
owner: utilities:grid-dpo
version: "3.1"
effective: 2026-09-15
contains_injection: false
---

# AMI Metering Operations Guide

## 1. Overview

Northvale Energy's advanced metering infrastructure (AMI) connects meters at customer premises to a central
head-end system over a radio mesh network. Meters record consumption in **15-minute intervals** and send them to
the head-end several times a day. The meter data management system validates the intervals, estimates any that
are missing or invalid and publishes one daily read per meter per day to the data platform. This guide explains
how read quality is measured and how incidents are handled.

## 2. Intervals and daily reads

A full day contains **96 intervals** (24 hours × 4). For each meter-day the daily read records consumption in
kWh, the peak 15-minute demand in kW, the intervals expected and the intervals received and valid. Intervals
flagged as estimated or missing do not count as valid. When a meter sends a corrected read for the same day, the
latest read replaces the earlier one, so there is exactly one daily read per meter per day.

## 3. Read success rate

The **read success rate** is the share of expected 15-minute intervals received and valid. At meter-day level it
is intervals valid divided by intervals expected, as a percentage; network and regional figures are the average
across meter-days. The service target is **at least 98.5%** for every month and region. The read success column
is a critical data element because estimated billing, peak demand and load research all depend on it.

The **estimated read share** is 100% minus the read success rate: the share of intervals the meter data
management system had to estimate.

## 4. Why read quality matters for billing

Bills are rendered from validated reads. When too many intervals in a billing period are estimated, the billing
system flags the statement as estimated. A sustained fall in read success therefore shows up a few weeks later as
a rise in the estimated bill rate and in high-bill contacts to the customer contact centre.

## 5. Monitoring

Metering operations monitors read success daily by region, feeder and city. An alert is raised when the
network read success falls below 97% for a day or when any feeder falls below 95% for two consecutive days.
Daily read volumes are also monitored: a day with materially fewer meter-days than the trailing average
indicates a missing file from the head-end rather than a field problem.

## 6. The August 2026 head-end firmware incident

On 20 August 2026 a firmware update was pushed from the head-end to a large group of meters. A defect in the
update caused affected meters to drop intervals during their scheduled uploads. Read success fell well below
target from **20 to 27 August 2026**, with the largest effect in the days immediately after the push.

The incident was detected by the daily read success alert on 21 August. The firmware vendor supplied a fix,
which was rolled out in stages and completed on 27 August, after which read success returned to normal. Because
billing periods overlapping those days were rendered on estimated intervals, the estimated bill rate rose for
statements issued between mid-August and early September. Those statements are trued up on the next actual
read.

When analysing August and September 2026, analysts and agents should mention the firmware incident if read
success, estimated reads or estimated bills are materially different from other months.

## 7. Meter exchanges

Meters are exchanged when they fail communication repeatedly or reach end of life. Exchanges are scheduled
through work management, and the premise keeps its history across the exchange.

## 8. Data access

Premise-level interval data may be disclosed only to the customer of record or an authorised agent. Analytical
products report consumption and read quality aggregated by region, feeder, rate class, premise type or city.
