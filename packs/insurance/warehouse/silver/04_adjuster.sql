CREATE OR REPLACE TABLE CURATED_SILVER.ADJUSTER AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.HR_ADJUSTER
  QUALIFY row_number() OVER (PARTITION BY adjuster_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT adjuster_id, CURATED_SILVER.proper(adjuster_name) AS adjuster_name,
       CURATED_SILVER.canon(region, ['Northeast', 'Midwest', 'South', 'West']) AS region,
       licensed_year, year(GOVERNANCE.as_of()) - licensed_year AS experience_years, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
