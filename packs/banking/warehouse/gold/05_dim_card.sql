CREATE OR REPLACE TABLE CONFORMED_GOLD.DIM_CARD AS
SELECT row_number() OVER (ORDER BY k.card_id) AS card_key, k.card_id, c.customer_key, k.card_product, k.credit_limit, k.open_date
FROM CURATED_SILVER.CARD_ACCOUNT k
JOIN CONFORMED_GOLD.DIM_CUSTOMER c ON c.customer_id = k.customer_id;
