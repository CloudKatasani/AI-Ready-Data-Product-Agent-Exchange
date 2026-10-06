-- Underwriting transactions: earned-premium records and claims conformed into one ledger shape so loss, LAE,
-- expense and combined ratios share a single denominator. Premium rows carry no losses; claim rows carry no premium.
CREATE OR REPLACE TABLE CURATED_SILVER.UW_TRANSACTION AS
SELECT concat('P-', p.premium_id) AS txn_id, 'Premium' AS txn_type, p.policy_id, p.line_of_business,
       p.accounting_month AS txn_date, p.earned_premium, p.written_premium, p.uw_expense, p.exposure_months,
       0.0 AS incurred_loss, 0.0 AS paid_loss, 0.0 AS lae_amount, 0 AS claim_count, FALSE AS is_catastrophe, CAST(NULL AS VARCHAR) AS cat_code
FROM CURATED_SILVER.PREMIUM_MONTH p
UNION ALL
SELECT concat('C-', c.claim_id), 'Claim', c.policy_id, c.line_of_business,
       c.loss_date, 0.0, 0.0, 0.0, 0,
       c.incurred_loss, c.paid_loss, c.lae_amount, 1, c.is_catastrophe, c.cat_code
FROM CURATED_SILVER.CLAIM_HEADER c;
