CREATE OR REPLACE TABLE CURATED_SILVER.REMITTANCE AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.PB_REMITTANCE
  QUALIFY row_number() OVER (PARTITION BY remit_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT remit_id, claim_id, payment_date, paid_amount,
       CURATED_SILVER.canon(payment_method, ['EFT', 'Paper check', 'Virtual card']) AS payment_method, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D' AND payment_date IS NOT NULL;
