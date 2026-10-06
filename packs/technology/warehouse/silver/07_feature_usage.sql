CREATE OR REPLACE TABLE CURATED_SILVER.FEATURE_USAGE AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.TELEMETRY_FEATURE_USAGE
  QUALIFY row_number() OVER (PARTITION BY feature_usage_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT feature_usage_id, account_id, feature_code, events_30d, last_event_date, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D'
QUALIFY row_number() OVER (PARTITION BY account_id, feature_code ORDER BY _loaded_at DESC, feature_usage_id DESC) = 1;
