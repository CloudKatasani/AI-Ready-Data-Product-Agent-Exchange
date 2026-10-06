-- Sampled policy-month premium records: month number decoded to the accounting month.
CREATE OR REPLACE TABLE CURATED_SILVER.PREMIUM_MONTH AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.PAS_PREMIUM_MONTH
  QUALIFY row_number() OVER (PARTITION BY premium_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT premium_id, policy_id,
       CURATED_SILVER.canon(line_of_business, ['Personal Auto', 'Homeowners', 'Commercial Auto', 'Commercial Property', 'General Liability', 'Workers Compensation']) AS line_of_business,
       CAST(DATE '2025-01-01' + to_months(month_no - 1) AS DATE) AS accounting_month,
       exposure_months, written_premium, earned_premium, uw_expense, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
