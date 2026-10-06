CREATE OR REPLACE TABLE CURATED_SILVER.BRANCH AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.CORE_BRANCH
  QUALIFY row_number() OVER (PARTITION BY branch_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT branch_id, concat(trim(city), ' ', branch_id) AS branch_name, trim(city) AS city,
       CURATED_SILVER.canon(region, ['Mountain', 'Plains', 'Great Lakes', 'Southeast']) AS region,
       CURATED_SILVER.canon(branch_type, ['Full service', 'In-store', 'Commercial center', 'Drive-up']) AS branch_type,
       open_year, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
