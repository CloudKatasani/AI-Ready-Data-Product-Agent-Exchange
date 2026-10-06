CREATE OR REPLACE TABLE CURATED_SILVER.VEGETATION_SPAN AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.VEG_SPAN_INSPECTION
  QUALIFY row_number() OVER (PARTITION BY span_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT span_id, feeder_id, last_trim_date, cycle_years, inspected_date, least(risk_score, 100.0) AS risk_score,
       CURATED_SILVER.canon(species, ['Oak', 'Maple', 'Pine', 'Poplar', 'Ash', 'Mixed']) AS species,
       trim(inspector_notes) AS inspector_notes, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
