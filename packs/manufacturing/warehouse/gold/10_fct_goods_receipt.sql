CREATE OR REPLACE TABLE CONFORMED_GOLD.FCT_GOODS_RECEIPT AS
SELECT row_number() OVER (ORDER BY r.receipt_id) AS receipt_key, r.receipt_id, s.supplier_key, p.plant_key,
       CAST(strftime(r.receipt_date, '%Y%m%d') AS INTEGER) AS date_key, r.po_date, r.promised_date, r.receipt_date,
       r.qty_ordered, r.qty_received, r.qty_rejected, r.on_time, r.in_full, r.otif, r.lead_time_days, r.receipt_value_usd,
       r.buyer_rescheduled
FROM CURATED_SILVER.GOODS_RECEIPT r
JOIN CONFORMED_GOLD.DIM_SUPPLIER s ON s.supplier_id = r.supplier_id
JOIN CONFORMED_GOLD.DIM_PLANT p ON p.plant_id = r.plant_id;
