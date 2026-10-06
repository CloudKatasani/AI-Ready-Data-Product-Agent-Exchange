CREATE OR REPLACE TABLE CURATED_SILVER.VENDOR_AGREEMENT AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.ERP_VENDOR_AGREEMENT
  QUALIFY row_number() OVER (PARTITION BY agreement_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT agreement_id, vendor_id, start_date, end_date, annual_commitment_usd, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
