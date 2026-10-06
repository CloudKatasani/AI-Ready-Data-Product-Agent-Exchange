-- Conformed customer dimension: KYC review currency (CDD refresh cycle by risk rating), tenure and age bands.
CREATE OR REPLACE TABLE CONFORMED_GOLD.DIM_CUSTOMER AS
WITH kyc AS (
  SELECT customer_id, max(review_date) AS last_review FROM CURATED_SILVER.KYC_REVIEW GROUP BY customer_id
), base AS (
  SELECT c.*, greatest(c.kyc_last_review, coalesce(k.last_review, c.kyc_last_review)) AS kyc_last_review_date,
         date_diff('year', c.open_date, GOVERNANCE.as_of()) AS tenure_years,
         date_diff('year', c.date_of_birth, GOVERNANCE.as_of()) AS age_years
  FROM CURATED_SILVER.CUSTOMER c
  LEFT JOIN kyc k ON k.customer_id = c.customer_id
)
SELECT row_number() OVER (ORDER BY c.customer_id) AS customer_key, c.customer_id,
       c.first_name, c.last_name, concat(c.first_name, ' ', c.last_name) AS full_name, c.email, c.phone, c.street_address,
       c.date_of_birth, c.ssn,
       CASE WHEN c.age_years < 30 THEN 'Under 30' WHEN c.age_years < 45 THEN '30-44' WHEN c.age_years < 60 THEN '45-59' ELSE '60+' END AS age_band,
       c.region, b.branch_key AS home_branch_key, c.segment, c.status, c.digital_active, c.products_held, c.relationship_balance,
       c.kyc_risk_rating, c.kyc_last_review_date,
       CAST(c.kyc_last_review_date + CASE c.kyc_risk_rating WHEN 'High' THEN INTERVAL 1 YEAR WHEN 'Medium' THEN INTERVAL 2 YEAR ELSE INTERVAL 3 YEAR END AS DATE) AS kyc_review_due,
       c.kyc_last_review_date + CASE c.kyc_risk_rating WHEN 'High' THEN INTERVAL 1 YEAR WHEN 'Medium' THEN INTERVAL 2 YEAR ELSE INTERVAL 3 YEAR END < GOVERNANCE.as_of() AS kyc_overdue,
       c.status = 'Closed' AS closed_12m, c.open_date, c.tenure_years,
       CASE WHEN c.tenure_years < 2 THEN 'Under 2 years' WHEN c.tenure_years < 5 THEN '2-4 years' WHEN c.tenure_years < 10 THEN '5-9 years' ELSE '10+ years' END AS tenure_band
FROM base c
LEFT JOIN CONFORMED_GOLD.DIM_BRANCH b ON b.branch_id = c.home_branch_id;
