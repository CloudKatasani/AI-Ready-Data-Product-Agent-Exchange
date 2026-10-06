-- Facility dimension: licensed hospital campuses with their market (region) and type.
CREATE OR REPLACE TABLE CONFORMED_GOLD.DIM_FACILITY AS
SELECT row_number() OVER (ORDER BY facility_id) AS facility_key, facility_id, facility_name, region, facility_type,
       licensed_beds,
       CASE WHEN licensed_beds >= 300 THEN 'Large (300+ beds)' WHEN licensed_beds >= 100 THEN 'Medium (100-299 beds)' ELSE 'Small (<100 beds)' END AS bed_size_band
FROM CURATED_SILVER.FACILITY;
