CREATE OR REPLACE TABLE CONFORMED_GOLD.FCT_CYCLE_COUNT AS
SELECT row_number() OVER (ORDER BY c.count_id) AS count_key, c.count_id, st.store_key,
       CAST(strftime(c.count_date, '%Y%m%d') AS INTEGER) AS date_key, c.count_date, c.count_category, c.cycle_months,
       c.last_full_count_date, CAST(c.last_full_count_date + to_months(c.cycle_months) AS DATE) AS next_count_due,
       c.last_full_count_date + to_months(c.cycle_months) < GOVERNANCE.as_of() AS overdue,
       c.system_value, c.shrink_value, round(100.0 * c.shrink_value / c.system_value, 2) AS shrink_pct,
       c.shrink_value <= 0.02 * c.system_value AS within_tolerance, c.risk_score
FROM CURATED_SILVER.CYCLE_COUNT c
JOIN CONFORMED_GOLD.DIM_STORE st ON st.store_id = c.store_id;
