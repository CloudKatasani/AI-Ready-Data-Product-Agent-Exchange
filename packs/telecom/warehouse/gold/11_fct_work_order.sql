-- One row per work order. Technician name, customer contact phone and service address are carried for dispatch
-- (PII; MASK_PII / MASK_PHONE).
CREATE OR REPLACE TABLE CONFORMED_GOLD.FCT_WORK_ORDER AS
SELECT row_number() OVER (ORDER BY w.wo_id) AS work_order_key, w.wo_id, m.market_key, s.subscriber_key,
       CAST(strftime(w.opened_date, '%Y%m%d') AS INTEGER) AS date_key, w.opened_ts, w.wo_type, w.status, w.closed,
       w.truck_roll, w.first_time_fix, w.hours_to_resolve, w.appointment_met, w.activation_days,
       t.skill AS technician_skill, t.tech_name AS technician_name, w.customer_phone, w.service_address
FROM CURATED_SILVER.WORK_ORDER w
JOIN CURATED_SILVER.TECHNICIAN t ON t.tech_id = w.tech_id
JOIN CONFORMED_GOLD.DIM_MARKET m ON m.market_id = w.market_id
JOIN CONFORMED_GOLD.DIM_SUBSCRIBER s ON s.subscriber_id = w.subscriber_id;
