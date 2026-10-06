-- Shipper (customer) master: deduplicated CDC, names title-cased, segment and contract type conformed.
CREATE OR REPLACE TABLE CURATED_SILVER.SHIPPER AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.TMS_CUSTOMER
  QUALIFY row_number() OVER (PARTITION BY customer_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT customer_id, CURATED_SILVER.proper(customer_name) AS customer_name,
       CURATED_SILVER.canon(segment, ['Retail', 'Food & beverage', 'Manufacturing', 'Building materials', 'Automotive', 'Paper & packaging']) AS segment,
       CURATED_SILVER.canon(region, ['Northeast', 'Southeast', 'Central', 'Mountain', 'West']) AS region,
       CURATED_SILVER.canon(contract_type, ['Dedicated', 'Contract', 'Spot']) AS contract_type,
       CURATED_SILVER.proper(contact_first_name) AS contact_first_name, CURATED_SILVER.proper(contact_last_name) AS contact_last_name,
       lower(trim(contact_email)) AS contact_email, contact_phone, customer_since, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
