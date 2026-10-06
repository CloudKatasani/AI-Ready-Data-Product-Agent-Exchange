-- Sales lines: CDC duplicates and tombstones removed, channel conformed, discount and margin derived.
CREATE OR REPLACE TABLE CURATED_SILVER.SALES_LINE AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.POS_SALES_LINE
  QUALIFY row_number() OVER (PARTITION BY line_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT line_id, txn_id, store_id, item_id, member_id, sale_date,
       CURATED_SILVER.canon(channel, ['In-store', 'Online', 'Click & collect']) AS channel,
       quantity, unit_price, unit_cost, discount_pct, on_promo, gross_amount,
       round(gross_amount - net_amount, 2) AS discount_amount, net_amount, cost_amount,
       round(net_amount - cost_amount, 2) AS margin_amount, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
