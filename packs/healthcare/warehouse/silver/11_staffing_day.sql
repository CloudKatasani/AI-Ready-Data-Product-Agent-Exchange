-- One row per care unit per day: CDC duplicates removed, then same-day resubmissions collapsed to the latest.
CREATE OR REPLACE TABLE CURATED_SILVER.STAFFING_DAY AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.WFM_STAFFING_DAY
  QUALIFY row_number() OVER (PARTITION BY staffing_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
), live AS (SELECT * FROM latest WHERE _op <> 'D')
SELECT staffing_id, unit_id, shift_date, staffed_beds, census, worked_hours, overtime_hours, agency_hours, target_hppd,
       _loaded_at AS loaded_at
FROM live
QUALIFY row_number() OVER (PARTITION BY unit_id, shift_date ORDER BY _loaded_at DESC, staffing_id DESC) = 1;
