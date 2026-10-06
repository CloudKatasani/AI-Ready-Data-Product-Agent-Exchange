-- Sales order lines: deduplicated; proof-of-delivery date = promise date + days early or late. Lines whose delivery
-- falls after the reporting date are still open. In full = the whole ordered quantity shipped (BR-MFG-019).
CREATE OR REPLACE TABLE CURATED_SILVER.SALES_ORDER_LINE AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.ERP_SALES_ORDER_LINE
  QUALIFY row_number() OVER (PARTITION BY order_line_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
), live AS (
  SELECT *, CAST(promised_date + delay_days AS DATE) AS pod_date FROM latest WHERE _op <> 'D'
)
SELECT order_line_id, distributor_id, family_id, CURATED_SILVER.bu(business_unit) AS business_unit, order_date, promised_date,
       CASE WHEN pod_date <= GOVERNANCE.as_of() THEN pod_date END AS delivered_date,
       pod_date <= GOVERNANCE.as_of() AS delivered,
       qty_ordered, CASE WHEN pod_date <= GOVERNANCE.as_of() THEN qty_shipped END AS qty_shipped,
       unit_price_usd, std_unit_cost_usd, round(qty_ordered * unit_price_usd, 2) AS net_value_usd, _loaded_at AS loaded_at
FROM live;
