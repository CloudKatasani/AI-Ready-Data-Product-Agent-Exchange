CREATE OR REPLACE TABLE CURATED_SILVER.PAYMENT AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.BSS_PAYMENT
  QUALIFY row_number() OVER (PARTITION BY payment_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT payment_id, invoice_id, subscriber_id,
       CURATED_SILVER.canon(pay_method, ['Autopay', 'Card', 'Cash', 'Bank transfer']) AS pay_method,
       days_to_pay, write_off_flag AS written_off, card_number, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
