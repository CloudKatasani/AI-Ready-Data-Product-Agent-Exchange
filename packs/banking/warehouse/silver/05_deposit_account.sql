CREATE OR REPLACE TABLE CURATED_SILVER.DEPOSIT_ACCOUNT AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.CORE_DEPOSIT_ACCOUNT
  QUALIFY row_number() OVER (PARTITION BY account_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT account_id, customer_id, branch_id,
       CURATED_SILVER.canon(deposit_product, ['Checking', 'Savings', 'Money market', 'Time deposit']) AS deposit_product,
       interest_rate_pct, account_status, open_date, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
