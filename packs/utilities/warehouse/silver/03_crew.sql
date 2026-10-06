CREATE OR REPLACE TABLE CURATED_SILVER.CREW AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.OMS_CREW
  QUALIFY row_number() OVER (PARTITION BY crew_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT crew_id, CURATED_SILVER.proper(crew_lead) AS crew_lead, CURATED_SILVER.canon(home_region, ['North', 'South', 'East', 'West', 'Central']) AS home_region,
       contractor_flag, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
