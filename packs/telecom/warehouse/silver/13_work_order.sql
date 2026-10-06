-- Work orders: type conformed; resolution hours only once closed; activation lead time only for fiber activations.
CREATE OR REPLACE TABLE CURATED_SILVER.WORK_ORDER AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.FSM_WORK_ORDER
  QUALIFY row_number() OVER (PARTITION BY wo_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
), live AS (
  SELECT *, CURATED_SILVER.canon(wo_type, ['New install', 'Fiber activation', 'Broadband repair', 'Network site repair']) AS wt,
         CURATED_SILVER.canon(status, ['Closed', 'Open']) AS st
  FROM latest WHERE _op <> 'D'
)
SELECT wo_id, tech_id, market_id, subscriber_id, customer_phone, CURATED_SILVER.proper(service_address) AS service_address,
       wt AS wo_type, opened_ts, CAST(opened_ts AS DATE) AS opened_date, st AS status, st = 'Closed' AS closed,
       truck_roll_flag AS truck_roll, CASE WHEN st = 'Closed' THEN ftf_flag END AS first_time_fix,
       CASE WHEN st = 'Closed' THEN hours_to_resolve END AS hours_to_resolve,
       appointment_met_flag AS appointment_met,
       CASE WHEN wt = 'Fiber activation' AND st = 'Closed' THEN activation_days END AS activation_days,
       _loaded_at AS loaded_at
FROM live;
