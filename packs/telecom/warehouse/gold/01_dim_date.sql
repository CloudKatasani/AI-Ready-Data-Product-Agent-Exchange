-- Calendar 2008-01-01 .. 2026-12-31 (fiscal year = calendar year).
CREATE OR REPLACE TABLE CONFORMED_GOLD.DIM_DATE AS
SELECT CAST(strftime(d, '%Y%m%d') AS INTEGER) AS date_key, CAST(d AS DATE) AS date,
       year(d) AS year, quarter(d) AS quarter, month(d) AS month, CAST(date_trunc('month', d) AS DATE) AS month_start,
       CAST(date_trunc('quarter', d) AS DATE) AS quarter_start, concat('Q', quarter(d), ' ', year(d)) AS quarter_label,
       strftime(d, '%b %Y') AS month_label, isodow(d) AS iso_weekday, isodow(d) >= 6 AS is_weekend,
       CAST(d AS DATE) = last_day(d) AS is_month_end
FROM range(DATE '2008-01-01', DATE '2027-01-01', INTERVAL 1 DAY) t(d);
