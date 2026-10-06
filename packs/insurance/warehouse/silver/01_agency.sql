CREATE OR REPLACE TABLE CURATED_SILVER.AGENCY AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.AMS_AGENCY
  QUALIFY row_number() OVER (PARTITION BY agency_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT agency_id, trim(agency_name) AS agency_name,
       CURATED_SILVER.canon(region, ['Northeast', 'Midwest', 'South', 'West']) AS region,
       CURATED_SILVER.canon(channel, ['Independent agent', 'Captive agent', 'Broker', 'Direct digital']) AS channel,
       appointed_year, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
