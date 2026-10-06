---
id: DOC-TCH-SUPPORT-SLA
title: Support Service Levels and Availability Policy
domain: customer-support
owner: technology:data-product-owner
version: "4.0"
effective: 2026-03-01
---

# Support Service Levels and Availability Policy

## 1. Purpose

This policy sets Cobalt Cloud Software's commitments for support responsiveness and platform availability, and
defines how attainment is measured and reported to customers.

## 2. Ticket priorities

| Priority | Meaning | First-response target |
|---|---|---|
| P1 | Platform unavailable or data at risk for the account | 30 minutes |
| P2 | Major feature degraded, no workaround | 2 hours |
| P3 | Feature issue with a workaround, or a configuration problem | 8 hours |
| P4 | Question, how-to or minor request | 24 hours |

Priority is set by the customer at creation and may be corrected by the support engineer within the first hour.

## 3. First response and SLA attainment

The **first response** is the first reply from a support engineer; automated acknowledgements do not count.
A ticket **meets SLA** when its first response is within the target for its priority. **SLA attainment** is the
share of tickets created in the period that met SLA.

Tickets **merged** into another ticket as duplicates are excluded from first response, SLA attainment and
resolution time, because they are answered on the surviving ticket. During release surges duplicates can be a
large share of tickets; including them would understate attainment.

## 4. Resolution and satisfaction

**Resolution time** is the elapsed time from creation to the ticket being solved. After resolution the requester
receives a one-question survey. **CSAT** is the share of responses rating the experience 4 or 5 out of 5.

## 5. Platform availability

The platform is committed at **99.9% uptime per quarter** for Scale and Enterprise plans. Uptime is one minus the
downtime minutes experienced by tenants divided by scheduled tenant minutes. Maintenance announced at least five
days in advance is excluded at source. A regional pod incident counts against every tenant hosted in that pod.

## 6. Reporting

Support leadership reviews SLA attainment, first response and CSAT weekly by priority, channel and region.
Customers on Scale and Enterprise plans may request a quarterly SLA report. Contact details of requesters are
personal data: reports are aggregated and never list requester names, emails or phone numbers.
