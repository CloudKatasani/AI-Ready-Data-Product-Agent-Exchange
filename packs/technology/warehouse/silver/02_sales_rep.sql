CREATE OR REPLACE TABLE CURATED_SILVER.SALES_REP AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.CRM_SALES_REP
  QUALIFY row_number() OVER (PARTITION BY rep_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT rep_id, CURATED_SILVER.proper(rep_name) AS rep_name,
       CURATED_SILVER.canon(home_region, ['North America', 'EMEA', 'APAC', 'LATAM']) AS home_region,
       CURATED_SILVER.canon(sales_team, ['Enterprise', 'Commercial', 'Velocity']) AS sales_team, hire_date, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
