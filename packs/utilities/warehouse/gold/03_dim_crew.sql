CREATE OR REPLACE TABLE CONFORMED_GOLD.DIM_CREW AS
SELECT row_number() OVER (ORDER BY crew_id) AS crew_key, crew_id, crew_lead, home_region,
       CASE WHEN contractor_flag THEN 'Contractor' ELSE 'Internal' END AS crew_type
FROM CURATED_SILVER.CREW;
