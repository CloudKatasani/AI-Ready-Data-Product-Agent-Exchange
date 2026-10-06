-- Current operator roster (MES badge). Names and email are PII and masked by policy.
CREATE OR REPLACE TABLE CONFORMED_GOLD.DIM_OPERATOR AS
SELECT row_number() OVER (ORDER BY o.badge_no) AS operator_key, o.badge_no, o.first_name, o.last_name,
       concat(o.first_name, ' ', o.last_name) AS full_name, o.email, o.plant_id, o.business_unit, o.job_role, o.cert_level,
       o.employment_status, o.hire_date
FROM CURATED_SILVER.OPERATOR_ROSTER o;
