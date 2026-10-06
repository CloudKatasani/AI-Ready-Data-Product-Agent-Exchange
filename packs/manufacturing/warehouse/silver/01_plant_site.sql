-- Plant master: deduplicated CDC, business unit conformed.
CREATE OR REPLACE TABLE CURATED_SILVER.PLANT_SITE AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.MDM_PLANT
  QUALIFY row_number() OVER (PARTITION BY plant_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT plant_id, trim(plant_name) AS plant_name, CURATED_SILVER.bu(business_unit) AS business_unit, upper(trim(country)) AS country,
       emission_factor, headcount, opened_year, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
