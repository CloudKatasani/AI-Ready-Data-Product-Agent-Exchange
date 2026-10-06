CREATE OR REPLACE TABLE CURATED_SILVER.PERMIT_INSPECTION AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.PRM_INSPECTION
  QUALIFY row_number() OVER (PARTITION BY inspection_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT inspection_id, permit_id,
       CURATED_SILVER.canon(inspection_type, ['Footing', 'Framing', 'Electrical rough-in', 'Plumbing rough-in', 'Final']) AS inspection_type,
       days_to_inspect, CURATED_SILVER.canon(result, ['Pass', 'Fail', 'Partial']) AS result,
       CURATED_SILVER.proper(inspector_name) AS inspector_name, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
