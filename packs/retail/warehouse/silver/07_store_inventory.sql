-- One position per store, item and day: CDC duplicates removed, then same-day re-sends collapsed to the latest.
CREATE OR REPLACE TABLE CURATED_SILVER.STORE_INVENTORY AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.WMS_STORE_INVENTORY
  QUALIFY row_number() OVER (PARTITION BY snapshot_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
), live AS (SELECT * FROM latest WHERE _op <> 'D')
SELECT snapshot_id, store_id, item_id, snapshot_date, greatest(on_hand_units, 0) AS on_hand_units, on_order_units,
       avg_daily_units, unit_cost, _loaded_at AS loaded_at
FROM live
QUALIFY row_number() OVER (PARTITION BY store_id, item_id, snapshot_date ORDER BY _loaded_at DESC, snapshot_id DESC) = 1;
