-- Web-store orders: deduplicated, codes conformed, delivery against promise derived.
CREATE OR REPLACE TABLE CURATED_SILVER.ONLINE_ORDER AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.ECOM_ORDER
  QUALIFY row_number() OVER (PARTITION BY order_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT order_id, member_id, order_date, order_value,
       CURATED_SILVER.canon(account_type, ['Consumer', 'Trade']) AS account_type,
       CURATED_SILVER.canon(fulfilment_method, ['Ship to home', 'Click & collect', 'Ship from store']) AS fulfilment_method,
       promised_days, delivered_days, delivered_days <= promised_days AS delivered_on_time,
       returned, returned_value, CASE WHEN returned THEN days_to_refund END AS days_to_refund, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
