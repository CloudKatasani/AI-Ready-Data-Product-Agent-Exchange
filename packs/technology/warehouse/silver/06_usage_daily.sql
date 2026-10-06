-- One telemetry row per account per day: CDC duplicates removed, late re-sends collapsed to the latest,
-- daily actives capped at monthly actives and monthly actives at licensed seats.
CREATE OR REPLACE TABLE CURATED_SILVER.USAGE_DAILY AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.TELEMETRY_USAGE_DAILY
  QUALIFY row_number() OVER (PARTITION BY usage_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
), live AS (SELECT * FROM latest WHERE _op <> 'D')
SELECT usage_id, account_id, usage_date, seats_licensed,
       least(monthly_active_users, seats_licensed) AS monthly_active_users,
       least(daily_active_users, monthly_active_users, seats_licensed) AS daily_active_users,
       downtime_minutes, _loaded_at AS loaded_at
FROM live
QUALIFY row_number() OVER (PARTITION BY account_id, usage_date ORDER BY _loaded_at DESC, usage_id DESC) = 1;
