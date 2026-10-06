-- Policyholder dimension: tenure, age band and multi-line relationship (in-force policies in two or more lines).
CREATE OR REPLACE TABLE CONFORMED_GOLD.DIM_POLICYHOLDER AS
WITH lines AS (
  SELECT policyholder_id, count(DISTINCT line_of_business) AS lines_held, count(*) AS policies_held
  FROM CURATED_SILVER.INSURANCE_POLICY WHERE policy_status = 'In force' GROUP BY policyholder_id
), base AS (
  SELECT h.*, date_diff('year', h.customer_since, GOVERNANCE.as_of()) AS tenure_years,
         date_diff('year', h.date_of_birth, GOVERNANCE.as_of()) AS age_years,
         coalesce(l.lines_held, 0) AS lines_held, coalesce(l.policies_held, 0) AS policies_held
  FROM CURATED_SILVER.POLICYHOLDER h
  LEFT JOIN lines l ON l.policyholder_id = h.policyholder_id
)
SELECT row_number() OVER (ORDER BY policyholder_id) AS policyholder_key, policyholder_id,
       first_name, last_name, concat(first_name, ' ', last_name) AS full_name, email, phone, street_address, date_of_birth, license_number,
       CASE WHEN age_years < 30 THEN 'Under 30' WHEN age_years < 45 THEN '30-44' WHEN age_years < 60 THEN '45-59' ELSE '60+' END AS age_band,
       state, region, segment, digital_registered, customer_since, tenure_years,
       CASE WHEN tenure_years < 2 THEN 'Under 2 years' WHEN tenure_years < 5 THEN '2-4 years' WHEN tenure_years < 10 THEN '5-9 years' ELSE '10+ years' END AS tenure_band,
       lines_held, policies_held, lines_held >= 2 AS multi_line
FROM base;
