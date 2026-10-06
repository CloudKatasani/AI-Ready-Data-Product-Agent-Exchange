-- One row per line shift with the OEE time base (OPS-STD-014): planned production time excludes planned downtime;
-- availability = run ÷ planned production time; performance = ideal minutes of all units ÷ run time; quality =
-- good ÷ started. good_ideal_min (good units at nameplate speed) ÷ planned production time is OEE.
CREATE OR REPLACE TABLE CONFORMED_GOLD.FCT_LINE_SHIFT AS
SELECT row_number() OVER (ORDER BY s.event_id) AS production_key, s.event_id, l.line_key, o.operator_key AS shift_lead_key,
       CAST(strftime(s.shift_date, '%Y%m%d') AS INTEGER) AS date_key, s.shift_date, s.shift_no,
       CASE s.shift_no WHEN 1 THEN 'Day' WHEN 2 THEN 'Swing' ELSE 'Night' END AS shift_name, s.run_type,
       s.scheduled_min, s.planned_down_min, s.scheduled_min - s.planned_down_min AS planned_production_min,
       s.unplanned_down_min, s.scheduled_min - s.planned_down_min - s.unplanned_down_min AS run_min,
       s.ideal_cycle_sec, s.units_started AS total_units, s.scrap_units, s.rework_units,
       s.units_started - s.scrap_units - s.rework_units AS good_units,
       round(s.units_started * s.ideal_cycle_sec / 60.0, 2) AS ideal_total_min,
       round((s.units_started - s.scrap_units - s.rework_units) * s.ideal_cycle_sec / 60.0, 2) AS good_ideal_min,
       s.top_loss_reason, s.energy_kwh
FROM CURATED_SILVER.LINE_SHIFT_PRODUCTION s
JOIN CONFORMED_GOLD.DIM_LINE l ON l.line_id = s.line_id
LEFT JOIN CONFORMED_GOLD.DIM_OPERATOR o ON o.badge_no = s.lead_badge;
