CREATE OR REPLACE TABLE CURATED_SILVER.VENDOR_MASTER AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.FIN_VENDOR
  QUALIFY row_number() OVER (PARTITION BY vendor_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT vendor_id, CURATED_SILVER.proper(vendor_name) AS vendor_name,
       CURATED_SILVER.canon(category, ['Construction services', 'Road materials', 'Fleet & equipment', 'IT & software', 'Professional services', 'Facilities maintenance', 'Social services providers', 'Office supplies']) AS category,
       local_small_business, tax_id, lower(contact_email) AS contact_email, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
