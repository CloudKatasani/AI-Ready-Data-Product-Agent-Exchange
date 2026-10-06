-- Shipper dimension. The logistics contact (name, email, phone) is personal data and is masked by policy.
CREATE OR REPLACE TABLE CONFORMED_GOLD.DIM_CUSTOMER AS
SELECT row_number() OVER (ORDER BY customer_id) AS customer_key, customer_id, customer_name, segment, region, contract_type,
       concat(contact_first_name, ' ', contact_last_name) AS contact_name, contact_email, contact_phone,
       customer_since, date_diff('year', customer_since, GOVERNANCE.as_of()) AS tenure_years
FROM CURATED_SILVER.SHIPPER;
