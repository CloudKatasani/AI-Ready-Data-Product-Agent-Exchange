CREATE OR REPLACE TABLE CURATED_SILVER.FEEDER_LOAD AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.SCADA_FEEDER_LOAD
  QUALIFY row_number() OVER (PARTITION BY reading_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT reading_id, feeder_id, reading_date, peak_mw, avg_mw, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
