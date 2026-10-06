CREATE OR REPLACE TABLE CONFORMED_GOLD.FCT_STORE_INVENTORY AS
SELECT row_number() OVER (ORDER BY v.snapshot_id) AS snapshot_key, v.snapshot_id, st.store_key, i.item_key,
       CAST(strftime(v.snapshot_date, '%Y%m%d') AS INTEGER) AS date_key, v.snapshot_date,
       v.on_hand_units, v.on_order_units, v.on_hand_units > 0 AS in_stock, v.avg_daily_units,
       CASE WHEN v.on_hand_units > 0 THEN round(v.on_hand_units / v.avg_daily_units, 1) END AS days_of_supply,
       v.unit_cost, round(v.on_hand_units * v.unit_cost, 2) AS inventory_value
FROM CURATED_SILVER.STORE_INVENTORY v
JOIN CONFORMED_GOLD.DIM_STORE st ON st.store_id = v.store_id
JOIN CONFORMED_GOLD.DIM_ITEM i ON i.item_id = v.item_id;
