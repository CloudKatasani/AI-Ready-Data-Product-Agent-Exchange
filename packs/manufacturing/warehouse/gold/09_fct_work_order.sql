CREATE OR REPLACE TABLE CONFORMED_GOLD.FCT_WORK_ORDER AS
SELECT row_number() OVER (ORDER BY w.wo_number) AS work_order_key, w.wo_number, a.asset_key, a.line_key,
       CAST(strftime(w.wo_date, '%Y%m%d') AS INTEGER) AS date_key, w.wo_date, w.wo_type, w.wo_type = 'Corrective' AS is_failure,
       w.run_hours_since_last, w.repair_hours, w.failure_cause, w.completed_on_schedule, w.cost_usd
FROM CURATED_SILVER.WORK_ORDER w
JOIN CONFORMED_GOLD.DIM_ASSET a ON a.asset_id = w.asset_id;
