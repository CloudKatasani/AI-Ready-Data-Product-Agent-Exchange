-- Safety events: deduplicated, event type conformed. A crash is DOT-recordable when its severity score is 55 or
-- more (injury, fatality or tow-away); the safety review board rules on preventability for recordable crashes.
CREATE OR REPLACE TABLE CURATED_SILVER.SAFETY_EVENT AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.SAF_EVENT
  QUALIFY row_number() OVER (PARTITION BY event_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
), live AS (
  SELECT *, CURATED_SILVER.canon(event_type, ['Hard-brake alert', 'Speeding alert', 'Hours-of-service violation', 'Roadside inspection violation', 'Crash']) AS event_type_c
  FROM latest WHERE _op <> 'D'
)
SELECT event_id, driver_id, tractor_id, event_date, event_type_c AS event_type, severity_score,
       event_type_c = 'Crash' AND severity_score >= 55 AS dot_recordable,
       event_type_c = 'Crash' AND severity_score >= 55 AND preventable_flag AS preventable,
       trim(location_note) AS location_note, _loaded_at AS loaded_at
FROM live;
