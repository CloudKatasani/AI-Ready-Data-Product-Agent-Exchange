CREATE OR REPLACE TABLE CURATED_SILVER.PRODUCT_FAMILY AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.MDM_PRODUCT_FAMILY
  QUALIFY row_number() OVER (PARTITION BY family_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT family_id, trim(family_name) AS family_name, CURATED_SILVER.bu(business_unit) AS business_unit, unit_price_usd,
       std_unit_cost_usd, warranty_months, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
