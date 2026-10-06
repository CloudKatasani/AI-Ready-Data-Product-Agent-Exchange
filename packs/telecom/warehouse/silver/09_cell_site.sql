CREATE OR REPLACE TABLE CURATED_SILVER.CELL_SITE AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.NET_CELL_SITE
  QUALIFY row_number() OVER (PARTITION BY site_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT site_id, market_id, CURATED_SILVER.canon(region, ['Northeast', 'Southeast', 'Central', 'West']) AS region,
       CURATED_SILVER.canon(technology, ['5G', 'LTE']) AS technology,
       CURATED_SILVER.canon(site_type, ['Macro', 'Small cell']) AS site_type,
       CURATED_SILVER.canon(site_class, ['Urban', 'Suburban', 'Rural']) AS site_class,
       CURATED_SILVER.canon(vendor, ['Kestrel Networks', 'Norrland Radio']) AS vendor,
       subscribers_served, on_air_year, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
