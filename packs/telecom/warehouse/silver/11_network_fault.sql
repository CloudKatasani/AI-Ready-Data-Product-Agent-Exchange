-- Fault tickets: restoration time only for restored faults; impacted subscribers from the share of the site's base.
CREATE OR REPLACE TABLE CURATED_SILVER.NETWORK_FAULT AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.OSS_FAULT_TICKET
  QUALIFY row_number() OVER (PARTITION BY fault_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT fault_id, site_id, raised_ts, CAST(raised_ts AS DATE) AS raised_date,
       CURATED_SILVER.canon(fault_class, ['Power', 'Backhaul', 'Radio equipment', 'Fiber cut', 'Software']) AS fault_class,
       CURATED_SILVER.canon(severity, ['Critical', 'Major', 'Minor']) AS severity,
       restored_flag AS restored, CASE WHEN restored_flag THEN restore_hours END AS restore_hours,
       CAST(round(subscribers_served * impact_share) AS INTEGER) AS impacted_subscribers,
       _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
