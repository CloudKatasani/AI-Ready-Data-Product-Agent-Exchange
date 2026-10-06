-- One row per meter per day: CDC duplicates removed, then same-day re-reads collapsed to the latest.
CREATE OR REPLACE TABLE CURATED_SILVER.METER_READ_DAILY AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.AMI_DAILY_READ
  QUALIFY row_number() OVER (PARTITION BY read_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
), live AS (SELECT * FROM latest WHERE _op <> 'D')
SELECT read_id, meter_id, read_date, kwh, peak_kw, intervals_expected, least(intervals_valid, intervals_expected) AS intervals_valid,
       _loaded_at AS loaded_at
FROM live
QUALIFY row_number() OVER (PARTITION BY meter_id, read_date ORDER BY _loaded_at DESC, read_id DESC) = 1;
