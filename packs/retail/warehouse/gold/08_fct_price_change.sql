CREATE OR REPLACE TABLE CONFORMED_GOLD.FCT_PRICE_CHANGE AS
SELECT row_number() OVER (ORDER BY p.change_id) AS change_key, p.change_id, i.item_key, st.store_key,
       CAST(strftime(p.effective_date, '%Y%m%d') AS INTEGER) AS date_key, p.change_type, p.markdown_pct, p.status,
       p.effective_date, p.executed_date,
       p.executed_date IS NOT NULL AND p.executed_date <= p.effective_date AS executed_on_time,
       p.executed_date IS NULL AND p.effective_date < GOVERNANCE.as_of() AS overdue,
       date_diff('day', p.effective_date, p.executed_date) AS days_late, p.labour_minutes, p.executed_by
FROM CURATED_SILVER.PRICE_CHANGE p
JOIN CONFORMED_GOLD.DIM_ITEM i ON i.item_id = p.item_id
JOIN CONFORMED_GOLD.DIM_STORE st ON st.store_id = p.store_id;
