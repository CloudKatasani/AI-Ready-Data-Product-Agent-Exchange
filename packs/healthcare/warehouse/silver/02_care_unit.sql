CREATE OR REPLACE TABLE CURATED_SILVER.CARE_UNIT AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.ADT_UNIT
  QUALIFY row_number() OVER (PARTITION BY unit_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT unit_id, facility_id,
       CURATED_SILVER.canon(unit_type, ['Med-surg', 'ICU', 'Step-down', 'Telemetry', 'Maternity', 'Behavioral health', 'Pediatrics']) AS unit_type,
       trim(unit_name) AS unit_name, staffed_beds, target_hppd, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
