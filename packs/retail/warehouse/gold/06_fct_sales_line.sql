-- One row per sales line. Lines dated before a store's opening date (pre-opening test transactions) are excluded.
CREATE OR REPLACE TABLE CONFORMED_GOLD.FCT_SALES_LINE AS
SELECT row_number() OVER (ORDER BY s.line_id) AS sales_line_key, s.line_id, s.txn_id, st.store_key, i.item_key, m.member_key,
       CAST(strftime(s.sale_date, '%Y%m%d') AS INTEGER) AS date_key, s.sale_date, s.channel,
       s.quantity, s.gross_amount, s.discount_amount, s.net_amount, s.cost_amount, s.margin_amount, s.on_promo,
       m.member_key IS NOT NULL AS member_identified
FROM CURATED_SILVER.SALES_LINE s
JOIN CONFORMED_GOLD.DIM_STORE st ON st.store_id = s.store_id
JOIN CONFORMED_GOLD.DIM_ITEM i ON i.item_id = s.item_id
LEFT JOIN CONFORMED_GOLD.DIM_MEMBER m ON m.member_id = s.member_id
WHERE s.sale_date >= st.open_date;
