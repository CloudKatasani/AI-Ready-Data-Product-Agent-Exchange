CREATE OR REPLACE TABLE CURATED_SILVER.MARKET AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.MKT_MARKET
  QUALIFY row_number() OVER (PARTITION BY market_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT market_id, trim(market_name) AS market_name, CURATED_SILVER.canon(region, ['Northeast', 'Southeast', 'Central', 'West']) AS region,
       launch_year, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
