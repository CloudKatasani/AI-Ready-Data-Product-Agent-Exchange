CREATE OR REPLACE TABLE CURATED_SILVER.PURCHASE_ORDER_LINE AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.ERP_PO_LINE
  QUALIFY row_number() OVER (PARTITION BY po_line_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT po_line_id, supplier_id,
       CURATED_SILVER.canon(category, ['Med-surg supplies', 'Pharmaceuticals', 'Implants & devices', 'Lab & diagnostics', 'Imaging equipment', 'Food & nutrition', 'Environmental services', 'IT & software']) AS category,
       po_date, spend_usd, on_contract, receipt_date, on_time_in_full AND receipt_date IS NOT NULL AS on_time_in_full,
       date_diff('day', po_date, receipt_date) AS cycle_days, CURATED_SILVER.proper(buyer) AS buyer, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
