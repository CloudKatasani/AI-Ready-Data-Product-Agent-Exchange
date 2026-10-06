CREATE OR REPLACE TABLE CURATED_SILVER.CLINICIAN AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.HR_PROVIDER
  QUALIFY row_number() OVER (PARTITION BY provider_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT provider_id, CURATED_SILVER.proper(provider_name) AS provider_name,
       CURATED_SILVER.canon(specialty, ['Primary care', 'Cardiology', 'Orthopedics', 'Neurology', 'Dermatology', 'Behavioral health', 'Oncology', 'Pediatrics', 'Obstetrics & gynecology', 'General surgery']) AS specialty,
       CURATED_SILVER.canon(employment_type, ['Employed', 'Affiliated']) AS employment_type, start_date, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
