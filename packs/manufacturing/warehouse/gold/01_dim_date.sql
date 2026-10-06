-- Calendar 2019-01-01 .. 2026-12-31 (fiscal year = calendar year; production weeks run Monday to Sunday, BR-MFG-006).
CREATE OR REPLACE TABLE CONFORMED_GOLD.DIM_DATE AS
SELECT CAST(strftime(d, '%Y%m%d') AS INTEGER) AS date_key, CAST(d AS DATE) AS date,
       year(d) AS year, quarter(d) AS quarter, month(d) AS month, CAST(date_trunc('month', d) AS DATE) AS month_start,
       CAST(date_trunc('quarter', d) AS DATE) AS quarter_start, concat('Q', quarter(d), ' ', year(d)) AS quarter_label,
       strftime(d, '%b %Y') AS month_label, CAST(date_trunc('week', d) AS DATE) AS production_week, isodow(d) AS iso_weekday,
       isodow(d) <= 5 AS is_workday
FROM range(DATE '2019-01-01', DATE '2027-01-01', INTERVAL 1 DAY) t(d);
