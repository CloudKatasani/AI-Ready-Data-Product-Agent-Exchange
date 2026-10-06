CREATE OR REPLACE TABLE CURATED_SILVER.SUPPLIER AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.ERP_SUPPLIER
  QUALIFY row_number() OVER (PARTITION BY supplier_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT supplier_id, CURATED_SILVER.proper(supplier_name) AS supplier_name,
       CURATED_SILVER.canon(category, ['Med-surg supplies', 'Pharmaceuticals', 'Implants & devices', 'Lab & diagnostics', 'Imaging equipment', 'Food & nutrition', 'Environmental services', 'IT & software']) AS category,
       preferred_flag, tax_id, lower(contact_email) AS contact_email, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
