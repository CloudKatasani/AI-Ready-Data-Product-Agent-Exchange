CREATE OR REPLACE TABLE CURATED_SILVER.CYCLE_COUNT AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.LP_CYCLE_COUNT
  QUALIFY row_number() OVER (PARTITION BY count_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT count_id, store_id,
       CURATED_SILVER.canon(count_category, ['Health & beauty', 'Electronics accessories', 'Apparel', 'Home', 'Grocery', 'Seasonal']) AS count_category,
       count_date, last_full_count_date, cycle_months, system_value, least(shrink_value, system_value) AS shrink_value,
       least(risk_score, 100.0) AS risk_score, trim(auditor_notes) AS auditor_notes, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
