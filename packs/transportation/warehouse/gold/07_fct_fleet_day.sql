-- One row per tractor per day, attributed to the tractor's home terminal.
CREATE OR REPLACE TABLE CONFORMED_GOLD.FCT_FLEET_DAY AS
SELECT row_number() OVER (ORDER BY f.fleet_day_id) AS fleet_day_key, f.fleet_day_id, tr.tractor_key, tr.terminal_key, dr.driver_key,
       CAST(strftime(f.activity_date, '%Y%m%d') AS INTEGER) AS date_key, f.activity_date, f.in_service,
       f.available_hours, f.revenue_hours, f.loaded_miles, f.empty_miles, f.total_miles, f.fuel_gallons, f.revenue_usd
FROM CURATED_SILVER.FLEET_DAY f
JOIN CONFORMED_GOLD.DIM_TRACTOR tr ON tr.tractor_id = f.tractor_id
LEFT JOIN CONFORMED_GOLD.DIM_DRIVER dr ON dr.driver_id = f.driver_id;
