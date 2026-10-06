CREATE OR REPLACE TABLE CURATED_SILVER.SUBSTATION AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.GIS_SUBSTATION
  QUALIFY row_number() OVER (PARTITION BY substation_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT substation_id, trim(substation_name) AS substation_name, CURATED_SILVER.canon(region, ['North', 'South', 'East', 'West', 'Central']) AS region,
       commissioned_year, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
