CREATE OR REPLACE TABLE CONFORMED_GOLD.DIM_PROVIDER AS
SELECT row_number() OVER (ORDER BY provider_id) AS provider_key, provider_id, provider_name, specialty, employment_type, start_date
FROM CURATED_SILVER.CLINICIAN;
