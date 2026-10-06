CREATE OR REPLACE TABLE CURATED_SILVER.FACILITY AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.FAC_FACILITY
  QUALIFY row_number() OVER (PARTITION BY facility_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT facility_id, trim(facility_name) AS facility_name,
       CURATED_SILVER.canon(region, ['Metro', 'Lakeshore', 'Riverside', 'Valley', 'Highland']) AS region,
       CURATED_SILVER.canon(facility_type, ['Academic medical center', 'Regional hospital', 'Community hospital', 'Critical access hospital']) AS facility_type,
       licensed_beds, opened_year, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
