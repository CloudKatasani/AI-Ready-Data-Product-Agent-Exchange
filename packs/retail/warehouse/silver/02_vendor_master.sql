CREATE OR REPLACE TABLE CURATED_SILVER.VENDOR_MASTER AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.ERP_VENDOR
  QUALIFY row_number() OVER (PARTITION BY vendor_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT vendor_id, CURATED_SILVER.proper(vendor_name) AS vendor_name,
       CURATED_SILVER.canon(vendor_category, ['Home textiles', 'Kitchen & dining', 'Apparel', 'Packaged food', 'Beverages', 'Beauty & personal care', 'Seasonal decor', 'Electronics accessories']) AS vendor_category,
       preferred_flag, tax_id, lower(contact_email) AS contact_email, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
