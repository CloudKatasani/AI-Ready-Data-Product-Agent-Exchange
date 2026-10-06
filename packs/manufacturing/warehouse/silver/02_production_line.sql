-- Production line master: deduplicated CDC, line type and status conformed.
CREATE OR REPLACE TABLE CURATED_SILVER.PRODUCTION_LINE AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.MDM_LINE
  QUALIFY row_number() OVER (PARTITION BY line_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT line_id, plant_id, CURATED_SILVER.bu(business_unit) AS business_unit,
       CURATED_SILVER.canon(line_type, ['Machining', 'Assembly', 'Fabrication', 'Surface treatment', 'Test & pack']) AS line_type,
       CURATED_SILVER.canon(line_status, ['Active', 'Commissioning']) AS line_status,
       CURATED_SILVER.canon(shift_pattern, ['2-shift', '3-shift']) AS shift_pattern,
       ideal_cycle_sec, kw_run, process_recipe_id, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
