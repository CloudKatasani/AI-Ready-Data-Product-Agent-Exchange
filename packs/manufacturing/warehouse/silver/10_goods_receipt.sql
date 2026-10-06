-- Goods receipts: deduplicated; the receipt date is the promise date plus the days early or late recorded by the
-- portal. Only receipts received by the reporting date are kept. OTIF = on or before the promise date and the
-- full ordered quantity (BR-MFG-014).
CREATE OR REPLACE TABLE CURATED_SILVER.GOODS_RECEIPT AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.SRM_GOODS_RECEIPT
  QUALIFY row_number() OVER (PARTITION BY receipt_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
), live AS (
  SELECT *, CAST(promised_date + delay_days AS DATE) AS receipt_date FROM latest WHERE _op <> 'D'
)
SELECT receipt_id, supplier_id,
       CURATED_SILVER.canon(category, ['Castings & forgings', 'Bearings', 'Electronic components', 'Seals & gaskets', 'Fasteners', 'Aerospace alloys',
                                       'Hydraulic fittings', 'Shafts & gears', 'Bar & plate', 'Printed circuit boards']) AS category,
       plant_id, CURATED_SILVER.bu(business_unit) AS business_unit, po_date, promised_date, delay_days, receipt_date, fill_pct,
       round(qty_received * 100.0 / fill_pct) AS qty_ordered, qty_received, least(qty_rejected, qty_received) AS qty_rejected,
       receipt_date <= promised_date AS on_time, fill_pct = 100 AS in_full, receipt_date <= promised_date AND fill_pct = 100 AS otif,
       date_diff('day', po_date, receipt_date) AS lead_time_days, receipt_value_usd, buyer_rescheduled, _loaded_at AS loaded_at
FROM live
WHERE receipt_date <= GOVERNANCE.as_of();
