-- Tenant-day usage for paying customers only: telemetry from days before an account landed or after it
-- cancelled (trial and offboarding tenants) is excluded. Every tenant-day is scheduled for 1,440 minutes.
CREATE OR REPLACE TABLE CONFORMED_GOLD.FCT_PRODUCT_USAGE AS
SELECT row_number() OVER (ORDER BY u.account_id, u.usage_date) AS usage_key, a.account_key,
       CAST(strftime(u.usage_date, '%Y%m%d') AS INTEGER) AS date_key, u.usage_date,
       u.seats_licensed, u.monthly_active_users, u.daily_active_users, u.downtime_minutes, 1440 AS scheduled_minutes
FROM CURATED_SILVER.USAGE_DAILY u
JOIN CONFORMED_GOLD.DIM_ACCOUNT a ON a.account_id = u.account_id
WHERE a.land_date <= u.usage_date AND (a.churn_date IS NULL OR a.churn_date > u.usage_date);
