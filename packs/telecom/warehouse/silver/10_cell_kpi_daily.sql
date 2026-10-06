-- Site-day counters: outage type conformed; downtime minutes derived from it; planned maintenance flagged so the
-- availability rule can exclude it; 5G carriers deliver about twice the LTE user throughput.
CREATE OR REPLACE TABLE CURATED_SILVER.CELL_KPI_DAILY AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.OSS_CELL_KPI_DAILY
  QUALIFY row_number() OVER (PARTITION BY kpi_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
), live AS (
  SELECT *, CURATED_SILVER.canon(outage_type, ['None', 'Unplanned outage', 'Planned maintenance']) AS ot,
         CURATED_SILVER.canon(technology, ['5G', 'LTE']) AS tech
  FROM latest WHERE _op <> 'D'
)
SELECT kpi_id, site_id, kpi_date, call_attempts, dropped_calls, setup_failures, ot AS outage_type,
       ot = 'Planned maintenance' AS planned_maintenance,
       CASE ot WHEN 'Planned maintenance' THEN maint_min WHEN 'Unplanned outage' THEN outage_min ELSE 0 END AS downtime_min,
       data_tb, round(CASE WHEN tech = '5G' THEN throughput_base * 2.1 ELSE throughput_base END, 1) AS throughput_mbps,
       _loaded_at AS loaded_at
FROM live;
