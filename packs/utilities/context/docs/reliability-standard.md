---
id: DOC-UTL-RELIABILITY-STD
title: Distribution Reliability Reporting Standard (IEEE 1366 application guide)
domain: outage-reliability
owner: utilities:grid-dpo
version: "3.2"
effective: 2026-01-12
contains_injection: false
---

# Distribution Reliability Reporting Standard

## 1. Purpose and scope

This standard explains how Northvale Energy calculates and reports distribution reliability indices to the
Calloway Public Utilities Commission and to internal leadership. It applies the IEEE 1366 guide for electric
power distribution reliability indices to Northvale's outage management data. It covers the sustained
interruption definition, the customers-served denominator, the three headline indices (SAIDI, SAIFI and
CAIDI) and the treatment of major event days. Every reliability figure filed with the commission or shown on
an executive dashboard must be calculated as described here, from the certified Distribution Reliability
data product.

## 2. What counts as an interruption

A **sustained interruption** is any loss of supply to one or more customers lasting longer than five minutes.
Momentary interruptions of five minutes or less, such as a recloser operation that restores supply
automatically, are excluded from SAIDI, SAIFI and CAIDI. They are tracked separately for power quality work
but never enter the regulated indices. Planned interruptions for maintenance are included unless the
commission has approved a specific exemption in writing.

Each sustained interruption is recorded as one outage event against the feeder that lost supply, with a
start time, a restoration time, the number of customers affected and a cause code. Customer minutes
interrupted for an event are the event duration in minutes multiplied by the customers affected.

## 3. The customers-served denominator

Customers served is the number of customers connected at the end of the reporting period. For system indices
the denominator is the total customers served across the whole service territory. When an index is reported
for a region, substation or feeder, the denominator is the customers served by that region, substation or
feeder, never the system total. Mixing the two denominators is the most common error in hand-built reliability
spreadsheets and produces regional SAIDI values that are far too low.

## 4. Index definitions

- **SAIDI** (System Average Interruption Duration Index) is the sum of customer minutes interrupted divided by
  customers served. It answers "how many minutes without power did the average customer experience?"
- **SAIFI** (System Average Interruption Frequency Index) is the total number of customer interruptions
  divided by customers served. It answers "how many times was the average customer interrupted?"
- **CAIDI** (Customer Average Interruption Duration Index) is customer minutes interrupted divided by customer
  interruptions, which equals SAIDI divided by SAIFI. It represents the average restoration time experienced
  by an interrupted customer.

SAIDI and CAIDI are reported in minutes to one decimal place. SAIFI is reported to three decimal places.

## 5. Major event days and the 2.5-beta method

Severe storms can interrupt a large share of customers in a single day and would otherwise dominate the
annual indices. IEEE 1366 separates these **major event days** (MED) using the 2.5-beta method:

1. Take daily SAIDI for the trailing five years, excluding days with zero SAIDI.
2. Compute the natural logarithm of each daily value.
3. Calculate the mean of the logarithms (alpha) and their standard deviation (beta).
4. The major event day threshold is exp(alpha + 2.5 × beta) minutes.
5. Any day whose daily SAIDI exceeds the threshold is a major event day.

The threshold is recalculated once a year, in January, and is fixed for the year. Northvale reports
reliability indices **excluding major event days** by default so that performance is comparable from year to
year. The commission also receives the indices including major event days as a separate line. Any analysis
that includes major event days must say so explicitly.

## 6. Reporting calendar

Quarterly indices are filed within 45 days of quarter end. The annual reliability report is filed by 31 March
for the prior calendar year and includes the ten worst-performing feeders by SAIDI, the causes driving them
and the remediation planned. Figures are quoted year to date, by quarter and by region.

## 7. Cause codes

Every outage carries one of the conformed cause codes: tree contact, equipment failure, animal, weather –
wind, lightning, vehicle accident or unknown. Tree contact outages feed the vegetation management programme
and are reviewed against trim cycle compliance. Crews must not record a cause that has not been confirmed in
the field; unconfirmed events remain "unknown" until reviewed.

## 8. Data lineage and evidence

Reliability indices must be traceable from the filed figure back to the outage events, the feeder customers
served and the metric definition used. The certified product, its version and the metric SQL are part of the
evidence pack for each filing.
