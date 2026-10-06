CREATE OR REPLACE TABLE CONFORMED_GOLD.DIM_PLAN AS
SELECT row_number() OVER (ORDER BY plan_id) AS plan_key, plan_id, plan_name, segment, lob, monthly_price, data_allowance_gb,
       CASE WHEN data_allowance_gb >= 999 THEN 'Unlimited' WHEN data_allowance_gb = 0 THEN 'Not applicable' ELSE concat(data_allowance_gb, ' GB') END AS data_allowance
FROM CURATED_SILVER.RATE_PLAN;
