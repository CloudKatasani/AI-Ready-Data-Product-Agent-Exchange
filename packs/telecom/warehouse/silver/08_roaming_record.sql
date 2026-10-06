CREATE OR REPLACE TABLE CURATED_SILVER.ROAMING_RECORD AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.ROAM_TAP_RECORD
  QUALIFY row_number() OVER (PARTITION BY record_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT record_id, market_id, event_date,
       CURATED_SILVER.canon(direction, ['Outbound retail', 'Inbound wholesale']) AS direction,
       CURATED_SILVER.canon(partner_zone, ['Zone 1 North America', 'Zone 2 Europe', 'Zone 3 Rest of world']) AS partner_zone,
       CURATED_SILVER.proper(partner_network) AS partner_network, data_mb, revenue_amount, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
