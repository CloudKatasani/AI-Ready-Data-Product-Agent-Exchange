-- Month-end reserve valuations: valuations dated before the loss are dropped; carried = case + IBNR.
CREATE OR REPLACE TABLE CURATED_SILVER.RESERVE_VALUATION AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.CLM_RESERVE_VALUATION
  QUALIFY row_number() OVER (PARTITION BY valuation_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
), live AS (
  SELECT *, CAST(last_day(DATE '2025-01-01' + to_months(month_no - 1)) AS DATE) AS valuation_date FROM latest WHERE _op <> 'D'
)
SELECT valuation_id, claim_id, policy_id, valuation_date,
       CURATED_SILVER.canon(line_of_business, ['Personal Auto', 'Homeowners', 'Commercial Auto', 'Commercial Property', 'General Liability', 'Workers Compensation']) AS line_of_business,
       loss_date, year(loss_date) AS accident_year, case_reserve, ibnr_reserve, case_reserve + ibnr_reserve AS carried_reserve,
       indicated_reserve, CURATED_SILVER.proper(claimant_name) AS claimant_name, claimant_phone, _loaded_at AS loaded_at
FROM live
WHERE valuation_date >= loss_date;
