-- Cargo claims: deduplicated, type and status conformed; claims not yet raised at the reporting date are dropped.
CREATE OR REPLACE TABLE CURATED_SILVER.CARGO_CLAIM AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.CLM_CARGO_CLAIM
  QUALIFY row_number() OVER (PARTITION BY claim_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT claim_id, load_id, claim_date,
       CURATED_SILVER.canon(claim_type, ['Damage', 'Shortage', 'Temperature excursion', 'Loss']) AS claim_type,
       claim_amount, CURATED_SILVER.canon(claim_status, ['Paid', 'Open', 'Denied']) AS claim_status, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D' AND claim_date IS NOT NULL AND claim_date <= GOVERNANCE.as_of();
