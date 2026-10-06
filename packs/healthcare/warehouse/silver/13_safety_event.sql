CREATE OR REPLACE TABLE CURATED_SILVER.SAFETY_EVENT AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.QM_SAFETY_EVENT
  QUALIFY row_number() OVER (PARTITION BY event_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT event_id, unit_id, event_date,
       CURATED_SILVER.canon(event_type, ['Fall', 'Pressure injury', 'CLABSI', 'CAUTI', 'Medication event', 'C. diff infection']) AS event_type,
       CURATED_SILVER.canon(harm_level, ['No harm', 'Minor harm', 'Moderate harm', 'Severe harm']) AS harm_level,
       CURATED_SILVER.proper(reporter) AS reporter, trim(narrative) AS narrative, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
