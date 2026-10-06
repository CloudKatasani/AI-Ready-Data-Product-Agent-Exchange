CREATE OR REPLACE TABLE CONFORMED_GOLD.FCT_PO_LINE AS
SELECT row_number() OVER (ORDER BY l.po_line_id) AS po_line_key, l.po_line_id, v.vendor_key,
       CAST(strftime(l.po_date, '%Y%m%d') AS INTEGER) AS date_key, l.po_date, l.category,
       l.units_ordered, l.units_received, l.po_cost_usd, l.at_agreed_cost,
       l.receipt_date IS NOT NULL AS received, l.on_time_in_full AS otif, l.lead_time_days
FROM CURATED_SILVER.PURCHASE_ORDER_LINE l
JOIN CONFORMED_GOLD.DIM_VENDOR v ON v.vendor_id = l.vendor_id;
