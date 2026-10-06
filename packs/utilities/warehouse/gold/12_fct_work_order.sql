CREATE OR REPLACE TABLE CONFORMED_GOLD.FCT_WORK_ORDER AS
SELECT row_number() OVER (ORDER BY w.work_order_id) AS work_order_key, w.work_order_id, a.asset_key, a.feeder_key,
       CAST(strftime(w.due_date, '%Y%m%d') AS INTEGER) AS date_key, w.wo_type, w.status, w.due_date, w.completed_date,
       w.completed_date IS NOT NULL AND w.completed_date <= w.due_date AS completed_on_time,
       w.completed_date IS NULL AND w.due_date < GOVERNANCE.as_of() AS overdue,
       date_diff('day', w.due_date, w.completed_date) AS days_late, w.labour_hours, w.planner
FROM CURATED_SILVER.WORK_ORDER w
JOIN CONFORMED_GOLD.DIM_ASSET a ON a.asset_id = w.asset_id;
