-- Conformed subscriber dimension: tenure, contract state, churn-risk band and care contacts in the last 90 days.
-- An active subscriber has status Active and is not an inactive prepaid line.
CREATE OR REPLACE TABLE CONFORMED_GOLD.DIM_SUBSCRIBER AS
WITH care AS (
  SELECT subscriber_id, count(*) AS contacts_90d FROM CURATED_SILVER.CARE_CONTACT
  WHERE contact_date > GOVERNANCE.as_of() - INTERVAL 90 DAY GROUP BY subscriber_id
), base AS (
  SELECT s.*, date_diff('month', s.activation_date, GOVERNANCE.as_of()) AS tenure_months,
         date_diff('year', s.date_of_birth, GOVERNANCE.as_of()) AS age_years
  FROM CURATED_SILVER.SUBSCRIBER s
)
SELECT row_number() OVER (ORDER BY s.subscriber_id) AS subscriber_key, s.subscriber_id, s.account_id,
       s.first_name, s.last_name, concat(s.first_name, ' ', s.last_name) AS full_name, s.email, s.msisdn, s.street_address,
       s.date_of_birth,
       CASE WHEN s.age_years < 30 THEN 'Under 30' WHEN s.age_years < 45 THEN '30-44' WHEN s.age_years < 60 THEN '45-59' ELSE '60+' END AS age_band,
       m.market_key, m.market_name, s.region, p.plan_key, p.plan_name, s.segment, s.lob, s.status,
       s.status = 'Active' AND NOT s.prepaid_inactive AS is_active, s.prepaid_inactive, s.autopay, s.device_financed,
       s.activation_date, s.tenure_months,
       CASE WHEN s.tenure_months < 12 THEN 'Under 1 year' WHEN s.tenure_months < 36 THEN '1-3 years' WHEN s.tenure_months < 84 THEN '3-7 years' ELSE '7+ years' END AS tenure_band,
       s.contract_type, s.contract_end_date,
       CASE WHEN s.segment = 'Postpaid' THEN s.contract_end_date IS NULL OR s.contract_end_date < GOVERNANCE.as_of() END AS out_of_contract,
       s.churn_propensity, s.churn_propensity >= 70 AS high_churn_risk,
       CASE WHEN s.churn_propensity >= 70 THEN 'High (70+)' WHEN s.churn_propensity >= 40 THEN 'Medium (40-69)' ELSE 'Low (<40)' END AS churn_risk_band,
       coalesce(c.contacts_90d, 0) AS care_contacts_90d
FROM base s
JOIN CONFORMED_GOLD.DIM_MARKET m ON m.market_id = s.market_id
JOIN CONFORMED_GOLD.DIM_PLAN p ON p.plan_id = s.plan_id
LEFT JOIN care c ON c.subscriber_id = s.subscriber_id;
