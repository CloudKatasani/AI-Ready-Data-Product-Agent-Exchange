CREATE OR REPLACE TABLE CONFORMED_GOLD.DIM_SUPPLIER AS
SELECT row_number() OVER (ORDER BY supplier_id) AS supplier_key, supplier_id, supplier_name, category,
       preferred_flag AS preferred, tax_id, contact_email
FROM CURATED_SILVER.SUPPLIER;
