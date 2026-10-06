CREATE OR REPLACE TABLE CONFORMED_GOLD.FCT_PO_SPEND AS
SELECT row_number() OVER (ORDER BY l.po_line_id) AS po_line_key, l.po_line_id, s.supplier_key,
       CAST(strftime(l.po_date, '%Y%m%d') AS INTEGER) AS date_key, l.po_date, l.category, l.spend_usd,
       l.on_contract, l.on_time_in_full AS otif, l.receipt_date IS NOT NULL AS received, l.cycle_days
FROM CURATED_SILVER.PURCHASE_ORDER_LINE l
JOIN CONFORMED_GOLD.DIM_SUPPLIER s ON s.supplier_id = l.supplier_id;
