-- One row per sampled loan-month (month-end snapshot).
CREATE OR REPLACE TABLE CONFORMED_GOLD.FCT_LOAN_BALANCE AS
SELECT row_number() OVER (ORDER BY s.balance_id) AS loan_balance_key, s.balance_id, l.loan_key, l.branch_key,
       CAST(strftime(s.month_end, '%Y%m%d') AS INTEGER) AS date_key, s.month_end, s.principal, s.dpd_days,
       CASE WHEN s.dpd_days >= 90 THEN '90+ DPD' WHEN s.dpd_days >= 60 THEN '60-89 DPD' WHEN s.dpd_days >= 30 THEN '30-59 DPD' ELSE 'Current' END AS dpd_bucket,
       s.non_accrual, s.non_performing, l.held_for_sale, s.charge_off_amount, s.recovery_amount,
       s.charge_off_amount - s.recovery_amount AS net_charge_off, s.allowance_amount,
       round(s.principal * l.note_rate_pct, 2) AS rate_weighted_principal
FROM CURATED_SILVER.LOAN_BALANCE s
JOIN CONFORMED_GOLD.DIM_LOAN l ON l.loan_id = s.loan_id;
