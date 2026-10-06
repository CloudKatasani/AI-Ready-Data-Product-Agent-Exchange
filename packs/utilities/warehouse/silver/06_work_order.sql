CREATE OR REPLACE TABLE CURATED_SILVER.WORK_ORDER AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.EAM_WORK_ORDER
  QUALIFY row_number() OVER (PARTITION BY work_order_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT work_order_id, asset_id, CURATED_SILVER.canon(wo_type, ['PM', 'CM']) AS wo_type, due_date,
       CASE WHEN CURATED_SILVER.canon(status, ['CLOSED', 'OPEN']) = 'CLOSED' THEN completed_date END AS completed_date,
       CURATED_SILVER.canon(status, ['CLOSED', 'OPEN']) AS status, labour_hours, CURATED_SILVER.proper(planner) AS planner, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
