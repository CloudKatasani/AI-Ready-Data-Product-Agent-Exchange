-- Feeder dimension with customers-served denominators at feeder, region and system scope (IEEE 1366).
CREATE OR REPLACE TABLE CONFORMED_GOLD.DIM_FEEDER AS
SELECT row_number() OVER (ORDER BY f.feeder_id) AS feeder_key,
       f.feeder_id, f.substation_id, s.substation_name, f.region, f.voltage_kv, f.circuit_miles, f.overhead_pct, f.install_year,
       CASE WHEN f.install_year < 1980 THEN 'Pre-1980' WHEN f.install_year < 2000 THEN '1980-1999' ELSE '2000+' END AS vintage_band,
       f.customers_served,
       sum(f.customers_served) OVER (PARTITION BY f.substation_id) AS substation_customers_served,
       sum(f.customers_served) OVER (PARTITION BY f.region) AS region_customers_served,
       sum(f.customers_served) OVER () AS system_customers_served
FROM CURATED_SILVER.FEEDER f
LEFT JOIN CURATED_SILVER.SUBSTATION s ON s.substation_id = f.substation_id;
