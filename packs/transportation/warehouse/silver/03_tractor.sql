-- Tractor (power unit) register: deduplicated CDC, equipment and make conformed.
CREATE OR REPLACE TABLE CURATED_SILVER.TRACTOR AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.FLT_TRACTOR
  QUALIFY row_number() OVER (PARTITION BY tractor_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT tractor_id, home_terminal_id,
       CURATED_SILVER.canon(equipment_type, ['Dry van', 'Reefer', 'Flatbed']) AS equipment_type,
       CURATED_SILVER.canon(make, ['Kestrel', 'Northway', 'Ironvale', 'Summit Ridge']) AS make,
       model_year, rated_mpg, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
