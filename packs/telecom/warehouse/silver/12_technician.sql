CREATE OR REPLACE TABLE CURATED_SILVER.TECHNICIAN AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.FSM_TECHNICIAN
  QUALIFY row_number() OVER (PARTITION BY tech_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT tech_id, CURATED_SILVER.proper(tech_name) AS tech_name, market_id, CURATED_SILVER.canon(region, ['Northeast', 'Southeast', 'Central', 'West']) AS region,
       CURATED_SILVER.canon(skill, ['Fiber', 'Wireless', 'Multi-skill']) AS skill, hire_year, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
