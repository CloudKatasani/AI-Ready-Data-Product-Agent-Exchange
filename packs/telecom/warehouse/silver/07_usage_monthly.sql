-- Mediated usage per line-month. The most-called number and serving cell are CPNI (MASK_CPNI).
CREATE OR REPLACE TABLE CURATED_SILVER.USAGE_MONTHLY AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.MED_USAGE_MONTHLY
  QUALIFY row_number() OVER (PARTITION BY usage_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT usage_id, subscriber_id, plan_id,
       CAST(last_day(DATE '2025-01-01' + to_months(month_no - 1)) AS DATE) AS month_end,
       data_gb, voice_min, sms_count, top_called_number, serving_site_id, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
