CREATE OR REPLACE TABLE CURATED_SILVER.ORDER_PAYMENT AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.ECOM_PAYMENT
  QUALIFY row_number() OVER (PARTITION BY payment_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT payment_id, order_id, payment_date, amount,
       CURATED_SILVER.canon(method, ['Card', 'Digital wallet', 'Gift card', 'Pay later']) AS method,
       card_number, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D' AND payment_date IS NOT NULL;
