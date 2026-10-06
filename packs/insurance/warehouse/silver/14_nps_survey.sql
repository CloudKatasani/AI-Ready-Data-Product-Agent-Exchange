CREATE OR REPLACE TABLE CURATED_SILVER.NPS_SURVEY AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.CX_NPS_SURVEY
  QUALIFY row_number() OVER (PARTITION BY survey_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT survey_id, contact_id, score,
       CASE WHEN score >= 9 THEN 'Promoter' WHEN score >= 7 THEN 'Passive' ELSE 'Detractor' END AS nps_category,
       _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D' AND score BETWEEN 0 AND 10;
