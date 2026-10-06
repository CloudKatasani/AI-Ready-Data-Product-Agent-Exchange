CREATE OR REPLACE TABLE CURATED_SILVER.CONTRACT AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.ERP_CONTRACT
  QUALIFY row_number() OVER (PARTITION BY contract_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT contract_id, supplier_id, start_date, end_date, ceiling_usd, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
