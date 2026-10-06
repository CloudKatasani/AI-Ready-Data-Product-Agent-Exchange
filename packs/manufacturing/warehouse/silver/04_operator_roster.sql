-- Operator roster: deduplicated CDC, names title-cased, roles conformed, employment status decoded.
CREATE OR REPLACE TABLE CURATED_SILVER.OPERATOR_ROSTER AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.HR_OPERATOR
  QUALIFY row_number() OVER (PARTITION BY badge_no ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT badge_no, CURATED_SILVER.proper(first_name) AS first_name, CURATED_SILVER.proper(last_name) AS last_name,
       lower(trim(email)) AS email, plant_id, CURATED_SILVER.bu(business_unit) AS business_unit,
       CURATED_SILVER.canon(job_role, ['Operator', 'Shift lead', 'Technician', 'Inspector']) AS job_role, cert_level,
       CASE emp_status WHEN 'A' THEN 'Active' WHEN 'L' THEN 'Leave' ELSE 'Terminated' END AS employment_status,
       hire_date, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
