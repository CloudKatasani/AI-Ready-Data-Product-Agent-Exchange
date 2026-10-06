-- Employee dimension (personal data masked by policy; never exposed through a semantic view).
CREATE OR REPLACE TABLE CONFORMED_GOLD.DIM_EMPLOYEE AS
SELECT row_number() OVER (ORDER BY e.employee_id) AS employee_key, e.employee_id,
       e.first_name, e.last_name, concat(e.first_name, ' ', e.last_name) AS full_name, e.work_email,
       le.entity_key, e.department, e.job_level, e.employment_type, e.hire_date, e.termination_date, e.termination_type, e.fte
FROM CURATED_SILVER.EMPLOYEE e
JOIN CONFORMED_GOLD.DIM_LEGAL_ENTITY le ON le.entity_id = e.entity_id;
