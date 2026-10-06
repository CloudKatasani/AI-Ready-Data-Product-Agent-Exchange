-- Customer account dimension with its primary contact (contact details are PII and masked by policy).
CREATE OR REPLACE TABLE CONFORMED_GOLD.DIM_CUSTOMER AS
SELECT row_number() OVER (ORDER BY customer_id) AS customer_key, customer_id, account_name,
       contact_first_name, contact_last_name, concat(contact_first_name, ' ', contact_last_name) AS contact_full_name,
       contact_email, contact_phone, region, segment, industry, created_date,
       date_diff('year', created_date, GOVERNANCE.as_of()) AS tenure_years
FROM CURATED_SILVER.CUSTOMER;
