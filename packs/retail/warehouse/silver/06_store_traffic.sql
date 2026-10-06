CREATE OR REPLACE TABLE CURATED_SILVER.STORE_TRAFFIC AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.STR_TRAFFIC_DAILY
  QUALIFY row_number() OVER (PARTITION BY reading_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT reading_id, store_id, traffic_date, footfall, conversion_pct, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
