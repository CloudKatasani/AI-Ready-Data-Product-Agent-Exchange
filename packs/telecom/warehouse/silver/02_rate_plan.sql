CREATE OR REPLACE TABLE CURATED_SILVER.RATE_PLAN AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.PRD_RATE_PLAN
  QUALIFY row_number() OVER (PARTITION BY plan_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT plan_id, trim(plan_name) AS plan_name,
       CURATED_SILVER.canon(segment, ['Postpaid', 'Prepaid', 'Broadband']) AS segment,
       CURATED_SILVER.canon(lob, ['Mobile', 'Broadband']) AS lob,
       monthly_price, data_allowance_gb, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
