-- Item dimension with initial margin and margin / price bands.
CREATE OR REPLACE TABLE CONFORMED_GOLD.DIM_ITEM AS
SELECT row_number() OVER (ORDER BY i.item_id) AS item_key, i.item_id, i.item_desc, i.category, i.department, i.brand_type,
       v.vendor_key, i.vendor_id, i.unit_cost, i.unit_price,
       round(100.0 * (i.unit_price - i.unit_cost) / i.unit_price, 2) AS initial_margin_pct,
       CASE WHEN 100.0 * (i.unit_price - i.unit_cost) / i.unit_price < 35 THEN 'Low'
            WHEN 100.0 * (i.unit_price - i.unit_cost) / i.unit_price < 50 THEN 'Medium' ELSE 'High' END AS margin_band,
       CASE WHEN i.unit_price < 15 THEN 'Under $15' WHEN i.unit_price < 40 THEN '$15 to $40' ELSE 'Over $40' END AS price_band,
       i.lifecycle_status, i.launch_date
FROM CURATED_SILVER.MERCH_ITEM i
LEFT JOIN CONFORMED_GOLD.DIM_VENDOR v ON v.vendor_id = i.vendor_id;
