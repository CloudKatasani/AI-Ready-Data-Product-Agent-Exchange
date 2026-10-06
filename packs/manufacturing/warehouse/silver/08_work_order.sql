-- Maintenance work orders: deduplicated, type and cause conformed. Run hours between failures and repair hours
-- only mean something on corrective work; preventive work is "Planned service" and is on time when done by its
-- scheduled date. Cost = labour at the standard rate + parts.
CREATE OR REPLACE TABLE CURATED_SILVER.WORK_ORDER AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.EAM_WORK_ORDER
  QUALIFY row_number() OVER (PARTITION BY wo_number ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
), conformed AS (
  SELECT *, CURATED_SILVER.canon(wo_type, ['Preventive', 'Corrective']) AS wo_type_c FROM latest WHERE _op <> 'D'
)
SELECT wo_number, asset_id, line_id, CURATED_SILVER.bu(business_unit) AS business_unit, wo_date, wo_type_c AS wo_type,
       CASE WHEN wo_type_c = 'Corrective' THEN run_hours_since_last END AS run_hours_since_last,
       repair_hours,
       CASE WHEN wo_type_c = 'Corrective'
            THEN CURATED_SILVER.canon(failure_cause, ['Spindle failure', 'Hydraulic leak', 'Sensor fault', 'Servo drive fault', 'Tooling breakage', 'Conveyor jam', 'Electrical fault'])
            ELSE 'Planned service' END AS failure_cause,
       CASE WHEN wo_type_c = 'Preventive' THEN days_late <= 0 END AS completed_on_schedule,
       round(repair_hours * labour_rate_usd + parts_cost_usd, 2) AS cost_usd, _loaded_at AS loaded_at
FROM conformed;
