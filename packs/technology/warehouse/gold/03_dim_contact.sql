CREATE OR REPLACE TABLE CONFORMED_GOLD.DIM_CONTACT AS
SELECT row_number() OVER (ORDER BY c.contact_id) AS contact_key, c.contact_id, a.account_key,
       c.first_name, c.last_name, concat(c.first_name, ' ', c.last_name) AS full_name, c.email, c.phone, c.job_title, c.is_primary
FROM CURATED_SILVER.ACCOUNT_CONTACT c
JOIN CONFORMED_GOLD.DIM_ACCOUNT a ON a.account_id = c.account_id;
