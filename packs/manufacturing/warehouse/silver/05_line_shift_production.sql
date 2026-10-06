-- Shift production: CDC duplicates and tombstones removed, run type and loss reasons conformed, and the OEE time
-- base derived once (OPS-STD-014): planned production time = scheduled time − planned downtime; run time =
-- planned production time − unplanned downtime; good units = started − scrap − rework.
CREATE OR REPLACE TABLE CURATED_SILVER.LINE_SHIFT_PRODUCTION AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.MES_SHIFT_PRODUCTION
  QUALIFY row_number() OVER (PARTITION BY event_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
), live AS (SELECT * FROM latest WHERE _op <> 'D')
SELECT event_id, line_id, plant_id, CURATED_SILVER.bu(business_unit) AS business_unit, shift_date, shift_no,
       CURATED_SILVER.canon(run_type, ['Production', 'Trial']) AS run_type,
       scheduled_min, planned_down_min, least(unplanned_down_min, scheduled_min - planned_down_min) AS unplanned_down_min,
       ideal_cycle_sec, units_started, least(scrap_units, units_started) AS scrap_units,
       least(rework_units, units_started - least(scrap_units, units_started)) AS rework_units,
       CASE WHEN unplanned_down_min > 0 THEN CURATED_SILVER.canon(top_loss_reason, ['Breakdown', 'Material shortage', 'Changeover overrun', 'Quality hold', 'Operator unavailable']) END AS top_loss_reason,
       lead_badge, energy_kwh, _loaded_at AS loaded_at
FROM live;
