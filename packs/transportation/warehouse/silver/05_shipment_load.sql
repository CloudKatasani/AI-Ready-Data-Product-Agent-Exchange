-- Loads: CDC duplicates and tombstones removed, codes conformed; delivery outcome, detention and the delay cause
-- are derived here from the TMS root columns (a delay is any delivery after the appointment window).
CREATE OR REPLACE TABLE CURATED_SILVER.SHIPMENT_LOAD AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.TMS_LOAD
  QUALIFY row_number() OVER (PARTITION BY load_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
), live AS (
  SELECT *, CURATED_SILVER.canon(load_type, ['Live', 'Drop & hook']) AS load_type_c,
         CURATED_SILVER.canon(delay_cause, ['Carrier', 'Customer', 'Weather']) AS delay_cause_c
  FROM latest WHERE _op <> 'D'
)
SELECT load_id, customer_id, origin_terminal_id,
       CURATED_SILVER.canon(dest_region, ['Northeast', 'Southeast', 'Central', 'Mountain', 'West']) AS dest_region,
       tractor_id, driver_id, pickup_date,
       CURATED_SILVER.canon(service_level, ['Standard', 'Appointment', 'Expedited']) AS service_level,
       load_type_c AS load_type,
       CURATED_SILVER.canon(equipment_type, ['Dry van', 'Reefer', 'Flatbed']) AS equipment_type,
       loaded_miles, empty_miles, loaded_miles + empty_miles AS total_miles,
       linehaul_revenue, fuel_surcharge,
       CASE WHEN load_type_c = 'Live' THEN round(greatest(dwell_hours - 2, 0), 2) ELSE 0 END AS detention_hours,
       CASE WHEN load_type_c = 'Live' THEN round(greatest(dwell_hours - 2, 0) * 65, 2) ELSE 0 END AS detention_revenue,
       operating_cost, fuel_cost, accessorial_cost, dwell_hours,
       delay_minutes, delay_minutes > 0 AS delivered_late,
       CASE WHEN delay_minutes > 0 THEN delay_cause_c END AS delay_cause,
       delay_minutes > 0 AND delay_cause_c = 'Customer' AS customer_caused_delay,
       exception_logged,
       CASE WHEN exception_logged THEN CURATED_SILVER.canon(exception_type, ['Damage', 'Refused', 'Misroute', 'Shortage']) END AS exception_type,
       _loaded_at AS loaded_at
FROM live;
