-- Premium payments (holds the card number; PCI — never carried into Gold).
CREATE OR REPLACE TABLE CURATED_SILVER.PAYMENT AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.BILL_PAYMENT
  QUALIFY row_number() OVER (PARTITION BY payment_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT payment_id, invoice_id, policy_id, CAST(invoice_date + pay_lag_days AS DATE) AS payment_date, paid_amount,
       CURATED_SILVER.canon(pay_method, ['Autopay - bank', 'Autopay - card', 'Check', 'Online one-time', 'Agency bill']) AS pay_method,
       card_number, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
