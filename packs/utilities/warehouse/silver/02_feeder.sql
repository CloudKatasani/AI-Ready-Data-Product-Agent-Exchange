CREATE OR REPLACE TABLE CURATED_SILVER.FEEDER AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.GIS_FEEDER
  QUALIFY row_number() OVER (PARTITION BY feeder_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT feeder_id, substation_id, CURATED_SILVER.canon(region, ['North', 'South', 'East', 'West', 'Central']) AS region,
       voltage_kv, circuit_miles, customers_served, overhead_pct, install_year, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
