CREATE OR REPLACE TABLE CONFORMED_GOLD.DIM_VENDOR AS
SELECT row_number() OVER (ORDER BY vendor_id) AS vendor_key, vendor_id, vendor_name, category,
       local_small_business, tax_id, contact_email
FROM CURATED_SILVER.VENDOR_MASTER;
