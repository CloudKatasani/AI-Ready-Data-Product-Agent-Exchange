CREATE OR REPLACE TABLE CONFORMED_GOLD.DIM_CONSTITUENT AS
SELECT row_number() OVER (ORDER BY constituent_id) AS constituent_key, constituent_id,
       first_name, last_name, concat(first_name, ' ', last_name) AS full_name, gov_id, email, phone, street_address,
       city, region, age_band, household_size, preferred_language, status, registered_date
FROM CURATED_SILVER.CONSTITUENT;
