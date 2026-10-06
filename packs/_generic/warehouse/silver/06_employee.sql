-- Employee master: deduplicated CDC, names title-cased, codes conformed; termination type only for leavers.
CREATE OR REPLACE TABLE CURATED_SILVER.EMPLOYEE AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.HRIS_EMPLOYEE
  QUALIFY row_number() OVER (PARTITION BY employee_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT employee_id, CURATED_SILVER.proper(first_name) AS first_name, CURATED_SILVER.proper(last_name) AS last_name,
       lower(trim(work_email)) AS work_email, entity_id,
       CURATED_SILVER.canon(department, ['Sales', 'Marketing', 'Operations', 'Engineering', 'Finance', 'People & Culture', 'Customer Support']) AS department,
       CURATED_SILVER.canon(job_level, ['Individual contributor', 'Manager', 'Senior manager', 'Director', 'Executive']) AS job_level,
       CURATED_SILVER.canon(employment_type, ['Permanent', 'Contractor', 'Intern']) AS employment_type,
       hire_date, termination_date,
       CASE WHEN termination_date IS NOT NULL THEN CURATED_SILVER.canon(termination_type, ['Voluntary', 'Involuntary']) END AS termination_type,
       fte, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
