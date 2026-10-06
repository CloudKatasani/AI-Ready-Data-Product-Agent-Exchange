-- Loan-month snapshots: non-performing = 90+ DPD or non-accrual; charge-offs, recoveries and the CECL allowance derived.
CREATE OR REPLACE TABLE CURATED_SILVER.LOAN_BALANCE AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.CORE_LOAN_BALANCE
  QUALIFY row_number() OVER (PARTITION BY balance_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
), live AS (SELECT * FROM latest WHERE _op <> 'D')
SELECT balance_id, loan_id, branch_id,
       CURATED_SILVER.canon(loan_segment, ['Residential mortgage', 'Home equity', 'Auto', 'Personal', 'Commercial real estate', 'Commercial & industrial']) AS loan_segment,
       held_for_sale, note_rate_pct,
       CAST(last_day(DATE '2025-01-01' + to_months(month_no - 1)) AS DATE) AS month_end,
       principal, dpd_days, non_accrual_flag AS non_accrual,
       dpd_days >= 90 OR non_accrual_flag AS non_performing,
       CASE WHEN charge_off_flag THEN round(principal * 0.42, 2) ELSE 0 END AS charge_off_amount,
       CASE WHEN recovery_flag THEN round(principal * 0.03, 2) ELSE 0 END AS recovery_amount,
       round(principal * CASE CURATED_SILVER.canon(loan_segment, ['Residential mortgage', 'Home equity', 'Auto', 'Personal', 'Commercial real estate', 'Commercial & industrial'])
                 WHEN 'Residential mortgage' THEN 0.006 WHEN 'Home equity' THEN 0.011 WHEN 'Auto' THEN 0.014 WHEN 'Personal' THEN 0.035
                 WHEN 'Commercial real estate' THEN 0.013 ELSE 0.012 END
             + CASE WHEN dpd_days >= 90 OR non_accrual_flag THEN principal * 0.22 ELSE 0 END, 2) AS allowance_amount,
       _loaded_at AS loaded_at
FROM live;
