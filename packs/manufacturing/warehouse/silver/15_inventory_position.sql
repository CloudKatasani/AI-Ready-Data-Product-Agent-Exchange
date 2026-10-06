-- One position per material, plant and day: CDC duplicates removed, then same-day re-sends collapsed to the latest.
-- Values at standard unit cost.
CREATE OR REPLACE TABLE CURATED_SILVER.INVENTORY_POSITION AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.ERP_INVENTORY_SNAPSHOT
  QUALIFY row_number() OVER (PARTITION BY snapshot_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
), live AS (SELECT * FROM latest WHERE _op <> 'D')
SELECT snapshot_id, material_id,
       CURATED_SILVER.canon(material_class, ['Raw material', 'Purchased component', 'Work in progress', 'Finished goods', 'MRO spare']) AS material_class,
       CURATED_SILVER.canon(material_status, ['Active', 'Obsolete']) AS material_status, upper(trim(abc_class)) AS abc_class,
       plant_id, CURATED_SILVER.bu(business_unit) AS business_unit, snapshot_date, greatest(on_hand_qty, 0) AS on_hand_qty, daily_usage_qty,
       safety_stock_days, unit_cost_usd, round(greatest(on_hand_qty, 0) * unit_cost_usd, 2) AS on_hand_value_usd,
       round(daily_usage_qty * unit_cost_usd, 2) AS daily_usage_value_usd, _loaded_at AS loaded_at
FROM live
QUALIFY row_number() OVER (PARTITION BY material_id, plant_id, snapshot_date ORDER BY _loaded_at DESC, snapshot_id DESC) = 1;
