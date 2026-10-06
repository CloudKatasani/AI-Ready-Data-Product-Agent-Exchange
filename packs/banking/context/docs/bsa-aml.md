---
id: DOC-BNK-BSA-AML
title: BSA/AML Programme — Monitoring, Investigation and KYC Standard
domain: financial-crime
owner: banking:data-steward
version: "5.0"
effective: 2026-01-01
contains_injection: false
---

# BSA/AML Programme — Monitoring, Investigation and KYC Standard

## 1. Purpose

Ridgeline's Bank Secrecy Act and anti-money-laundering programme detects, investigates and reports
suspicious activity. This standard defines the monitoring measures the BSA officer reviews monthly.

## 2. Transaction monitoring

Customer activity is screened by tuned monitoring scenarios: structuring, rapid movement of funds,
high-risk geography, cash-intensive activity and wire pattern anomalies. Each match creates an **alert**.

## 3. Disposition

Every alert is dispositioned by a named investigator as closed with no suspicion or escalated to an
investigation case. Alerts not yet reviewed are pending. The **alert-to-case rate** is escalated alerts
divided by dispositioned alerts; pending alerts are excluded. Alerts should be dispositioned within 30
days.

## 4. Investigation and SAR decisions

Escalated cases are investigated and closed with a SAR decision by the BSA officer. The **SAR conversion
rate** is SARs filed divided by closed cases. The existence or content of a SAR is confidential: it is
never disclosed to the subject, to relationship managers, or through analytical tools or agents.

## 5. Customer due diligence

Every customer carries a KYC risk rating. Due diligence is refreshed every year for high-risk customers,
every two years for medium-risk and every three years for low-risk customers. A review past its due date
is **overdue** and reported to the BSA officer monthly.

## 6. 2026 observations

In Q3 2026 rapid-movement-of-funds alerts in the Great Lakes market escalated to cases far more often than
usual, consistent with a money-mule network using newly opened accounts. Scenario thresholds are under
review.

## 7. Data handling

Alert subjects' names and addresses are personal information and must be masked for anyone outside the
financial crimes function.
