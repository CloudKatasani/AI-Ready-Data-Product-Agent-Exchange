-- Sustained outages, deduplicated, tombstones removed, cause codes conformed, CMI derived.
CREATE OR REPLACE TABLE CURATED_SILVER.OUTAGE_EVENT AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.OMS_OUTAGE_EVENTS
  QUALIFY row_number() OVER (PARTITION BY outage_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT outage_id, feeder_id, start_ts, CAST(start_ts AS DATE) AS outage_date,
       duration_min, customers_affected, duration_min * customers_affected AS customer_minutes,
       CURATED_SILVER.canon(cause_code, ['VEG', 'EQUIP', 'ANIMAL', 'WIND', 'LIGHTNING', 'VEHICLE', 'UNKNOWN']) AS cause_code,
       major_event_day, crew_id, trim(crew_notes) AS crew_notes, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
