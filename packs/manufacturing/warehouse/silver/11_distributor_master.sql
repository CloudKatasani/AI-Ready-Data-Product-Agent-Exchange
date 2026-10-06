-- Distributors: deduplicated, names and contacts conformed.
CREATE OR REPLACE TABLE CURATED_SILVER.DISTRIBUTOR_MASTER AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.CRM_DISTRIBUTOR
  QUALIFY row_number() OVER (PARTITION BY distributor_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT distributor_id, CURATED_SILVER.proper(distributor_name) AS distributor_name,
       CURATED_SILVER.canon(sales_region, ['Americas', 'EMEA', 'APAC']) AS sales_region,
       CURATED_SILVER.canon(tier, ['Platinum', 'Gold', 'Standard']) AS tier,
       CURATED_SILVER.proper(contact_first_name) AS contact_first_name, CURATED_SILVER.proper(contact_last_name) AS contact_last_name,
       lower(trim(contact_email)) AS contact_email, contact_phone, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
