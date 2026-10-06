-- One row per sampled line-month of mediated usage. Most-called number and serving site are CPNI (MASK_CPNI).
CREATE OR REPLACE TABLE CONFORMED_GOLD.FCT_MONTHLY_USAGE AS
SELECT row_number() OVER (ORDER BY u.usage_id) AS usage_key, u.usage_id, s.subscriber_key, p.plan_key, s.market_key,
       CAST(strftime(u.month_end, '%Y%m%d') AS INTEGER) AS date_key, u.month_end, u.data_gb, u.voice_min, u.sms_count,
       u.top_called_number, u.serving_site_id
FROM CURATED_SILVER.USAGE_MONTHLY u
JOIN CONFORMED_GOLD.DIM_SUBSCRIBER s ON s.subscriber_id = u.subscriber_id
JOIN CONFORMED_GOLD.DIM_PLAN p ON p.plan_id = u.plan_id;
