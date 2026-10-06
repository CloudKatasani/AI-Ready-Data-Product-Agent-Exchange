CREATE OR REPLACE TABLE CURATED_SILVER.PAYMENT AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.BILL_PAYMENT
  QUALIFY row_number() OVER (PARTITION BY payment_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT payment_id, statement_id, payment_date, amount,
       CURATED_SILVER.canon(channel, ['Autopay', 'Online', 'Mail', 'Walk-in', 'Phone']) AS channel,
       card_number, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D' AND payment_date IS NOT NULL;
