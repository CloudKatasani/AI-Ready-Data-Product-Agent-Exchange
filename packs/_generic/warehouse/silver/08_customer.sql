-- Customer accounts: deduplicated, contact names title-cased, emails lower-cased, codes conformed.
CREATE OR REPLACE TABLE CURATED_SILVER.CUSTOMER AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.CRM_ACCOUNT
  QUALIFY row_number() OVER (PARTITION BY customer_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT customer_id, CURATED_SILVER.proper(account_name) AS account_name,
       CURATED_SILVER.proper(contact_first_name) AS contact_first_name, CURATED_SILVER.proper(contact_last_name) AS contact_last_name,
       lower(trim(contact_email)) AS contact_email, contact_phone,
       CURATED_SILVER.canon(region, ['North America', 'Latin America', 'EMEA', 'APAC']) AS region,
       CURATED_SILVER.canon(segment, ['Enterprise', 'Mid-market', 'Small business']) AS segment,
       CURATED_SILVER.canon(industry, ['Manufacturing', 'Retail', 'Healthcare', 'Financial services', 'Public sector', 'Technology']) AS industry,
       created_date, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
