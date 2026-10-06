-- NPS responses: promoters score 9–10, passives 7–8, detractors 0–6.
CREATE OR REPLACE TABLE CURATED_SILVER.NPS_RESPONSE AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.CX_NPS_SURVEY
  QUALIFY row_number() OVER (PARTITION BY response_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT response_id, subscriber_id, survey_date,
       CURATED_SILVER.canon(touchpoint, ['Relationship', 'Care interaction', 'Install', 'Repair', 'Store visit']) AS touchpoint,
       score, CASE WHEN score >= 9 THEN 'Promoter' WHEN score >= 7 THEN 'Passive' ELSE 'Detractor' END AS nps_category,
       trim(verbatim) AS verbatim, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
