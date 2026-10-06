-- Filled requisitions with time to fill (days from opening to the hire date).
CREATE OR REPLACE TABLE CURATED_SILVER.REQUISITION AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.ATS_REQUISITION
  QUALIFY row_number() OVER (PARTITION BY requisition_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT requisition_id, hired_employee_id, department, opened_date, hire_date,
       date_diff('day', opened_date, hire_date) AS time_to_fill_days,
       CURATED_SILVER.canon(hire_source, ['External', 'Internal', 'Referral']) AS hire_source,
       CURATED_SILVER.proper(recruiter) AS recruiter, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
