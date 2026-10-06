CREATE OR REPLACE TABLE CONFORMED_GOLD.DIM_PLANT AS
SELECT row_number() OVER (ORDER BY plant_id) AS plant_key, plant_id, plant_name, business_unit, country, emission_factor, headcount, opened_year
FROM CURATED_SILVER.PLANT_SITE;
