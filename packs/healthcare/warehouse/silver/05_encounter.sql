-- Inpatient encounters, deduplicated, tombstones removed, codes conformed; discharge date and readmission
-- outcomes derived (an expired patient cannot be readmitted; a planned readmission is still a readmission).
CREATE OR REPLACE TABLE CURATED_SILVER.ENCOUNTER AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.ADT_ENCOUNTER
  QUALIFY row_number() OVER (PARTITION BY encounter_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
), conformed AS (
  SELECT encounter_id, patient_mrn, facility_id,
         CURATED_SILVER.canon(payer_class, ['Medicare', 'Medicaid', 'Commercial', 'Self-pay']) AS payer_class,
         admit_ts, CAST(CAST(admit_ts AS DATE) + los_days AS DATE) AS discharge_date, los_days, gmlos_days,
         CURATED_SILVER.canon(service_line, ['Medicine', 'Surgery', 'Cardiology', 'Orthopedics', 'Obstetrics', 'Oncology', 'Neurosciences', 'Behavioral health']) AS service_line,
         CURATED_SILVER.canon(condition_cohort, ['Heart failure', 'Pneumonia', 'COPD', 'Sepsis', 'Acute MI', 'Joint replacement', 'Stroke', 'All other']) AS condition_cohort,
         CURATED_SILVER.canon(discharge_disposition, ['Home', 'Home health', 'Skilled nursing facility', 'Inpatient rehab', 'Hospice', 'Left against medical advice', 'Expired']) AS discharge_disposition,
         readmit_flag, planned_flag, _loaded_at AS loaded_at
  FROM latest WHERE _op <> 'D'
)
SELECT encounter_id, patient_mrn, facility_id, payer_class, admit_ts, discharge_date, los_days, gmlos_days, service_line,
       condition_cohort, discharge_disposition,
       readmit_flag AND discharge_disposition <> 'Expired' AS readmit_30d,
       readmit_flag AND planned_flag AND discharge_disposition <> 'Expired' AS planned_readmission,
       loaded_at
FROM conformed;
