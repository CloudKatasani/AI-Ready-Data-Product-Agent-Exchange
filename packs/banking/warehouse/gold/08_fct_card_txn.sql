CREATE OR REPLACE TABLE CONFORMED_GOLD.FCT_CARD_TXN AS
SELECT row_number() OVER (ORDER BY a.auth_id) AS txn_key, a.auth_id, k.card_key, k.customer_key,
       CAST(strftime(a.auth_date, '%Y%m%d') AS INTEGER) AS date_key, a.auth_ts, a.auth_date, a.amount, a.approved,
       CASE WHEN a.approved THEN a.amount ELSE 0 END AS approved_amount, a.merchant_category, a.card_channel,
       a.fraud_confirmed, a.fraud_loss
FROM CURATED_SILVER.CARD_AUTHORIZATION a
JOIN CONFORMED_GOLD.DIM_CARD k ON k.card_id = a.card_id;
