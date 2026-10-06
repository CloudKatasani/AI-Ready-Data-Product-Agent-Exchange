---
id: DOC-TCH-REVENUE-POLICY
title: Revenue and Retention Metrics Policy
domain: revenue
owner: technology:cfo
version: "3.2"
effective: 2026-01-15
---

# Revenue and Retention Metrics Policy

## 1. Purpose

This policy defines how Cobalt Cloud Software measures recurring revenue and customer retention. It applies to
the board pack, investor updates, compensation plans, dashboards and every agent answer. A number that does not
follow these definitions is not ARR or net revenue retention, whatever the slide calls it.

## 2. Annual recurring revenue (ARR)

**ARR** is the annualised value of every recurring subscription line that is active on the last day of the month:
the base platform subscription, seat expansions and module cross-sells, net of seat reductions. A line is active
from its start date until the day before its end date. When a base subscription is cancelled, every recurring
add-on on it ends on the same day (add-ons are co-termed).

For a reporting window longer than one month, ARR is the **average of the month-end values** in the window. The
quarter-end ARR shown in the board pack is the value at the last month end of the quarter.

### 2.1 One-time services are not ARR

Implementation projects, training, migrations and other professional services are **one-time** revenue. They
are invoiced and recognised separately and are **never included in ARR** or in any retention metric. Including
them makes ARR jump in quarters with large implementation projects and fall back when the projects finish, which
is exactly the volatility ARR exists to remove. A question may ask for "ARR including one-time services" — the
answer must then say plainly that it is not the governed ARR figure.

## 3. Retention metrics

All retention metrics use a **trailing twelve-month cohort**: the accounts that had subscription ARR on the
same month end one year earlier.

- **Net revenue retention (NRR)** — ARR today from the cohort divided by the cohort's ARR a year ago. Expansion,
  contraction and churn are all included; new logos are not.
- **Gross revenue retention (GRR)** — the same, but each account is capped at its starting ARR, so expansion
  cannot offset losses. GRR can never exceed 100%.
- **Logo churn** — the share of cohort accounts whose subscription ARR is now zero. An account that reduces
  seats is contraction, not churn.

For a quarter, each metric is computed at each month end and the month-end values are combined by weight.

| Metric | Healthy band | Review trigger |
|---|---|---|
| Net revenue retention | 105–115% | Below 100% for two quarters |
| Gross revenue retention | 88–94% | Below 85% |
| Logo churn | 5–10% | Above 10% for two quarters |

## 4. ARR movements

Month-over-month ARR changes are classified for the ARR waterfall:

- **New logo ARR** — an account that had no ARR the previous month end.
- **Expansion ARR** — an increase on an account that was already paying.
- **Contraction ARR** — a decrease on an account that is still paying.
- **Churned ARR** — the full prior ARR of an account whose ARR fell to zero.

## 5. Product engagement metrics

Engagement metrics are measured over **paying customers only**. Telemetry from trial tenants and from tenants in
the offboarding window after cancellation is excluded. Daily active users are distinct users with a qualifying
action in a tenant-day; monthly active users use a thirty-day window. Stickiness is daily over monthly actives.

**Feature adoption** is measured only among accounts whose plan entitles them to the feature. An account adopts
a feature when it has at least one event in the last thirty days. Usage of a feature by an account that is not
entitled to it is an entitlement gap for the product team, not adoption.

## 6. Changes to definitions

Any change to these definitions requires a new version of the ARR & Retention data contract, approval by the
product owner and the Chief Financial Officer, and a restated comparison period.
