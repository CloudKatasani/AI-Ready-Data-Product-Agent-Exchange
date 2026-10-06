CREATE OR REPLACE TABLE CONFORMED_GOLD.FCT_INVENTORY_SNAPSHOT AS
SELECT row_number() OVER (ORDER BY v.snapshot_id) AS snapshot_key, v.snapshot_id, p.plant_key, v.material_id,
       CAST(strftime(v.snapshot_date, '%Y%m%d') AS INTEGER) AS date_key, v.snapshot_date,
       v.material_class, v.material_status, v.abc_class, v.on_hand_qty, v.daily_usage_qty, v.unit_cost_usd,
       v.on_hand_value_usd, v.daily_usage_value_usd, v.on_hand_qty = 0 AS stocked_out,
       v.on_hand_qty < v.daily_usage_qty * v.safety_stock_days AS below_safety_stock
FROM CURATED_SILVER.INVENTORY_POSITION v
JOIN CONFORMED_GOLD.DIM_PLANT p ON p.plant_id = v.plant_id;
