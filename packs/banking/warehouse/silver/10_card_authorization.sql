-- Card authorisations: codes conformed; confirmed fraud loss = approved amount on confirmed-fraud authorisations.
CREATE OR REPLACE TABLE CURATED_SILVER.CARD_AUTHORIZATION AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.CARD_AUTHORIZATION
  QUALIFY row_number() OVER (PARTITION BY auth_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT auth_id, card_id, customer_id, auth_ts, CAST(auth_ts AS DATE) AS auth_date, amount,
       CURATED_SILVER.canon(merchant_category, ['Grocery', 'Fuel', 'Dining', 'Travel', 'Online retail', 'Digital goods', 'Healthcare', 'Utilities & telecom']) AS merchant_category,
       CURATED_SILVER.canon(card_channel, ['Card present', 'Contactless', 'Card not present']) AS card_channel,
       approved, fraud_confirmed, CASE WHEN fraud_confirmed AND approved THEN amount ELSE 0 END AS fraud_loss,
       _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
