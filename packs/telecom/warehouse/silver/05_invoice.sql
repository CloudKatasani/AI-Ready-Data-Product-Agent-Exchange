-- Invoices: charges derived from the rating drivers. Rated = plan charge + overage + retail roaming; leakage is the
-- rated amount that never reached the bill; service revenue = billed charges (device installments excluded).
CREATE OR REPLACE TABLE CURATED_SILVER.INVOICE AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.BSS_INVOICE
  QUALIFY row_number() OVER (PARTITION BY invoice_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
), charges AS (
  SELECT *, round(plan_price * usage_factor, 2) AS plan_charge,
         CASE WHEN overage_flag THEN overage_base ELSE 0 END AS overage_amount,
         CASE WHEN roam_flag THEN roam_base ELSE 0 END AS roaming_amount
  FROM latest WHERE _op <> 'D'
), rated AS (
  SELECT *, round(plan_charge + overage_amount + roaming_amount, 2) AS rated_amount FROM charges
)
SELECT invoice_id, subscriber_id, market_id, plan_id,
       CURATED_SILVER.canon(segment, ['Postpaid', 'Prepaid', 'Broadband']) AS segment,
       CAST(last_day(DATE '2025-01-01' + to_months(month_no - 1)) AS DATE) AS month_end,
       plan_charge, overage_amount, roaming_amount, rated_amount,
       CASE WHEN leak_flag THEN round(rated_amount * leak_share, 2) ELSE 0 END AS leakage_amount,
       rated_amount - CASE WHEN leak_flag THEN round(rated_amount * leak_share, 2) ELSE 0 END AS billed_amount,
       CASE WHEN device_financed THEN installment_base ELSE 0 END AS device_installment,
       _loaded_at AS loaded_at
FROM rated;
