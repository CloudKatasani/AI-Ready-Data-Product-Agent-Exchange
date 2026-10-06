CREATE OR REPLACE TABLE CURATED_SILVER.PRICE_CHANGE AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.PRC_PRICE_CHANGE
  QUALIFY row_number() OVER (PARTITION BY change_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT change_id, item_id, store_id, CURATED_SILVER.canon(change_type, ['Markdown', 'Promotion', 'Permanent']) AS change_type,
       markdown_pct, effective_date,
       CASE WHEN CURATED_SILVER.canon(status, ['EXECUTED', 'PENDING']) = 'EXECUTED' THEN executed_date END AS executed_date,
       CURATED_SILVER.canon(status, ['EXECUTED', 'PENDING']) AS status, labour_minutes,
       CURATED_SILVER.proper(executed_by) AS executed_by, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
