CREATE OR REPLACE TABLE CURATED_SILVER.SURVEY_RESPONSE AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.PG_SURVEY
  QUALIFY row_number() OVER (PARTITION BY survey_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT survey_id, patient_mrn, facility_id, survey_date, overall_rating,
       CURATED_SILVER.canon(recommend, ['Definitely yes', 'Probably yes', 'Probably no', 'Definitely no']) AS recommend,
       nurse_comm_top_box, trim(comments) AS comments, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
