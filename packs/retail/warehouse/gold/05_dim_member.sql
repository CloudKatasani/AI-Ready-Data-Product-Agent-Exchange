CREATE OR REPLACE TABLE CONFORMED_GOLD.DIM_MEMBER AS
SELECT row_number() OVER (ORDER BY m.member_id) AS member_key, m.member_id,
       m.first_name, m.last_name, concat(m.first_name, ' ', m.last_name) AS full_name, m.email, m.phone, m.street_address,
       m.region, m.tier, m.status, m.app_enrolled, m.churn_score AS churn_risk_score,
       CASE WHEN m.churn_score >= 60 THEN 'High' WHEN m.churn_score >= 35 THEN 'Medium' ELSE 'Low' END AS churn_risk_band,
       m.points_balance, m.join_date, date_diff('year', m.join_date, GOVERNANCE.as_of()) AS tenure_years
FROM CURATED_SILVER.LOYALTY_MEMBER m;
