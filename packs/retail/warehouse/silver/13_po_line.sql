CREATE OR REPLACE TABLE CURATED_SILVER.PURCHASE_ORDER_LINE AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.ERP_PO_LINE
  QUALIFY row_number() OVER (PARTITION BY po_line_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT po_line_id, vendor_id, CURATED_SILVER.canon(category, ['Home textiles', 'Kitchen & dining', 'Apparel', 'Packaged food', 'Beverages', 'Beauty & personal care', 'Seasonal decor', 'Electronics accessories']) AS category,
       po_date, units_ordered, CASE WHEN receipt_date IS NOT NULL THEN units_received END AS units_received, po_cost_usd, at_agreed_cost,
       receipt_date, on_time AND fill_pct = 100 AND receipt_date IS NOT NULL AS on_time_in_full,
       date_diff('day', po_date, receipt_date) AS lead_time_days, CURATED_SILVER.proper(buyer) AS buyer, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
