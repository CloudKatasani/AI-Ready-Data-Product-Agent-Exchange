CREATE OR REPLACE TABLE CURATED_SILVER.RELATIONSHIP_MANAGER AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.CRM_RELATIONSHIP_MANAGER
  QUALIFY row_number() OVER (PARTITION BY rm_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT rm_id, CURATED_SILVER.proper(rm_name) AS rm_name, branch_id,
       CURATED_SILVER.canon(region, ['Mountain', 'Plains', 'Great Lakes', 'Southeast']) AS region,
       CURATED_SILVER.canon(book_type, ['Retail', 'Private', 'Small business', 'Commercial']) AS book_type, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
