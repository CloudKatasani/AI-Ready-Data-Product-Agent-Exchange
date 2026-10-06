CREATE OR REPLACE TABLE CURATED_SILVER.APPOINTMENT AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.SCH_APPOINTMENT
  QUALIFY row_number() OVER (PARTITION BY appointment_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT appointment_id, patient_mrn, facility_id, provider_id,
       CURATED_SILVER.canon(specialty, ['Primary care', 'Cardiology', 'Orthopedics', 'Neurology', 'Dermatology', 'Behavioral health', 'Oncology', 'Pediatrics', 'Obstetrics & gynecology', 'General surgery']) AS specialty,
       appointment_date, lead_days,
       CURATED_SILVER.canon(visit_type, ['New patient', 'Established', 'Follow-up', 'Telehealth']) AS visit_type,
       CURATED_SILVER.canon(status, ['Completed', 'No-show', 'Cancelled', 'Bumped']) AS status, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
