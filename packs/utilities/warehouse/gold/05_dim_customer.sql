CREATE OR REPLACE TABLE CONFORMED_GOLD.DIM_CUSTOMER AS
SELECT row_number() OVER (ORDER BY c.customer_no) AS customer_key, c.customer_no,
       c.first_name, c.last_name, concat(c.first_name, ' ', c.last_name) AS full_name, c.email, c.phone, c.street_address,
       c.region, c.rate_code AS rate_class,
       CASE c.rate_code WHEN 'RS-1' THEN 'Residential' WHEN 'RS-TOU' THEN 'Residential time-of-use' WHEN 'GS-1' THEN 'Small commercial' ELSE 'Large commercial' END AS rate_label,
       CASE WHEN c.rate_code IN ('RS-1', 'RS-TOU') THEN 'Residential' WHEN c.rate_code = 'GS-1' THEN 'Small business' ELSE 'Commercial & industrial' END AS segment,
       c.status, c.paperless AS digital_enrolled, c.churn_score AS churn_risk_score,
       CASE WHEN c.churn_score >= 60 THEN 'High' WHEN c.churn_score >= 35 THEN 'Medium' ELSE 'Low' END AS churn_risk_band,
       c.open_date, date_diff('year', c.open_date, GOVERNANCE.as_of()) AS tenure_years
FROM CURATED_SILVER.CUSTOMER c;
