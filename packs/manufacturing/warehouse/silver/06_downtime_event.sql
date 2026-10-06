-- Downtime events: reasons conformed and classified planned or unplanned (changeovers up to standard, planned
-- maintenance and breaks are planned downtime; everything else is an unplanned loss — BR-MFG-003).
CREATE OR REPLACE TABLE CURATED_SILVER.DOWNTIME_EVENT AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.MES_DOWNTIME_EVENT
  QUALIFY row_number() OVER (PARTITION BY event_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
), conformed AS (
  SELECT *, CURATED_SILVER.canon(reason, ['Breakdown', 'Material shortage', 'Changeover overrun', 'Quality hold', 'Operator unavailable',
                                          'Planned maintenance', 'Planned changeover', 'Break']) AS reason_c
  FROM latest WHERE _op <> 'D'
)
SELECT event_id, line_id, CURATED_SILVER.bu(business_unit) AS business_unit, start_ts, CAST(start_ts AS DATE) AS event_date, duration_min,
       reason_c AS reason, CASE WHEN reason_c IN ('Planned maintenance', 'Planned changeover', 'Break') THEN 'Planned' ELSE 'Unplanned' END AS category,
       _loaded_at AS loaded_at
FROM conformed;
