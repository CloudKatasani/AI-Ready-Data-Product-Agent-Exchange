-- Operating companies: deduplicated, region and business unit conformed; display name built from both.
CREATE OR REPLACE TABLE CURATED_SILVER.LEGAL_ENTITY AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.ERP_LEGAL_ENTITY
  QUALIFY row_number() OVER (PARTITION BY entity_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT entity_id,
       CURATED_SILVER.canon(region, ['North America', 'Latin America', 'EMEA', 'APAC']) AS region,
       CURATED_SILVER.canon(business_unit, ['Industrial Products', 'Consumer Brands', 'Business Services', 'Software & Data']) AS business_unit,
       incorporated_year, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
