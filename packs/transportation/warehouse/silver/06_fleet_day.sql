-- One telematics record per tractor and day: CDC duplicates removed, then same-day re-sends collapsed to the latest.
CREATE OR REPLACE TABLE CURATED_SILVER.FLEET_DAY AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.ELD_FLEET_DAY
  QUALIFY row_number() OVER (PARTITION BY fleet_day_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
), live AS (SELECT * FROM latest WHERE _op <> 'D')
SELECT fleet_day_id, tractor_id, driver_id, activity_date, NOT in_shop AS in_service,
       available_hours, revenue_hours, loaded_miles, empty_miles, loaded_miles + empty_miles AS total_miles,
       fuel_gallons, revenue_usd, _loaded_at AS loaded_at
FROM live
QUALIFY row_number() OVER (PARTITION BY tractor_id, activity_date ORDER BY _loaded_at DESC, fleet_day_id DESC) = 1;
