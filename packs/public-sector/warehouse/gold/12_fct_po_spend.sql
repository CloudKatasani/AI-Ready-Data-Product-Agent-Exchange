-- One row per requisition line; cycle days from requisition to purchase order (null until a PO is raised).
-- date_key is the PO date, so period figures cover purchase orders raised in the period.
CREATE OR REPLACE TABLE CONFORMED_GOLD.FCT_PO_SPEND AS
SELECT row_number() OVER (ORDER BY l.po_line_id) AS po_line_key, l.po_line_id, v.vendor_key,
       CAST(strftime(l.po_date, '%Y%m%d') AS INTEGER) AS date_key, l.requisition_date, l.po_date,
       l.category, l.department, l.procurement_method, l.po_date IS NOT NULL AS ordered, l.cycle_days,
       l.spend_usd, l.on_contract, l.buyer
FROM CURATED_SILVER.PURCHASE_ORDER_LINE l
JOIN CONFORMED_GOLD.DIM_VENDOR v ON v.vendor_id = l.vendor_id;
