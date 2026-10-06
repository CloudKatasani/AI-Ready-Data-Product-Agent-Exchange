-- Account dimension: CRM firmographics + the base subscription (plan tier, seats, cancellation date).
-- customer_status is evaluated at asOf: Active while the base subscription is live.
CREATE OR REPLACE TABLE CONFORMED_GOLD.DIM_ACCOUNT AS
SELECT row_number() OVER (ORDER BY a.account_id) AS account_key, a.account_id, a.account_name, a.region, a.segment, a.industry,
       a.acquisition_channel, a.employee_count, a.health_score, b.plan_tier, b.seats AS seats_licensed, b.billing_frequency,
       a.land_date, b.end_date AS churn_date,
       CASE WHEN b.start_date <= GOVERNANCE.as_of() AND (b.end_date IS NULL OR b.end_date > GOVERNANCE.as_of()) THEN 'Active' ELSE 'Churned' END AS customer_status,
       date_diff('year', a.land_date, GOVERNANCE.as_of()) AS tenure_years
FROM CURATED_SILVER.CUSTOMER_ACCOUNT a
LEFT JOIN CURATED_SILVER.SUBSCRIPTION_LINE b ON b.account_id = a.account_id AND b.line_type = 'Base subscription';
