-- One row per load. Revenue = linehaul + fuel surcharge + billed detention; claim cost = paid and open cargo claims
-- (denied claims excluded) raised against the load.
CREATE OR REPLACE TABLE CONFORMED_GOLD.FCT_LOAD AS
WITH claims AS (
  SELECT load_id, count(*) AS claim_count, sum(claim_amount) FILTER (WHERE claim_status <> 'Denied') AS claim_cost
  FROM CURATED_SILVER.CARGO_CLAIM GROUP BY load_id
)
SELECT row_number() OVER (ORDER BY l.load_id) AS load_key, l.load_id, c.customer_key, t.terminal_key, tr.tractor_key, dr.driver_key,
       CAST(strftime(l.pickup_date, '%Y%m%d') AS INTEGER) AS date_key, l.pickup_date, l.dest_region, l.service_level, l.load_type,
       l.equipment_type, l.loaded_miles, l.empty_miles, l.total_miles,
       l.linehaul_revenue, l.fuel_surcharge, l.detention_revenue,
       round(l.linehaul_revenue + l.fuel_surcharge + l.detention_revenue, 2) AS revenue,
       l.operating_cost, l.fuel_cost, l.accessorial_cost,
       round(l.operating_cost + l.fuel_cost + l.accessorial_cost, 2) AS total_cost,
       coalesce(cl.claim_count, 0) AS claim_count, round(coalesce(cl.claim_cost, 0), 2) AS claim_cost,
       l.dwell_hours, l.detention_hours, l.delay_minutes, l.delivered_late, NOT l.delivered_late AS on_time,
       l.delay_cause, l.customer_caused_delay, l.exception_logged, l.exception_type
FROM CURATED_SILVER.SHIPMENT_LOAD l
JOIN CONFORMED_GOLD.DIM_CUSTOMER c ON c.customer_id = l.customer_id
JOIN CONFORMED_GOLD.DIM_TERMINAL t ON t.terminal_id = l.origin_terminal_id
JOIN CONFORMED_GOLD.DIM_TRACTOR tr ON tr.tractor_id = l.tractor_id
LEFT JOIN CONFORMED_GOLD.DIM_DRIVER dr ON dr.driver_id = l.driver_id
LEFT JOIN claims cl ON cl.load_id = l.load_id;
