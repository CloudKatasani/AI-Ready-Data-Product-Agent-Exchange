CREATE OR REPLACE TABLE CURATED_SILVER.CARD_ACCOUNT AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.CARD_ACCOUNT
  QUALIFY row_number() OVER (PARTITION BY card_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT card_id, customer_id, CURATED_SILVER.canon(card_product, ['Classic', 'Rewards', 'Premium', 'Business']) AS card_product,
       credit_limit, open_date, card_number, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
