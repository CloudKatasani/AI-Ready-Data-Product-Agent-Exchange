CREATE OR REPLACE TABLE CURATED_SILVER.INVOICE AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.BILL_INVOICE
  QUALIFY row_number() OVER (PARTITION BY invoice_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT invoice_id, policy_id, invoice_date, amount_due,
       CURATED_SILVER.canon(pay_method, ['Autopay - bank', 'Autopay - card', 'Check', 'Online one-time', 'Agency bill']) AS pay_method,
       days_past_due, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
