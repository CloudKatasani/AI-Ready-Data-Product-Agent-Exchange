-- Calendar 2019-01-01 .. 2026-12-31 with the county fiscal year (July to June: FY2027 = Jul 2026 - Jun 2027)
-- and county business days (weekdays that are not county holidays).
CREATE OR REPLACE TABLE CONFORMED_GOLD.DIM_DATE AS
WITH holidays(h) AS (
  VALUES (DATE '2024-01-01'), (DATE '2024-01-15'), (DATE '2024-02-19'), (DATE '2024-05-27'), (DATE '2024-06-19'), (DATE '2024-07-04'),
         (DATE '2024-09-02'), (DATE '2024-11-11'), (DATE '2024-11-28'), (DATE '2024-11-29'), (DATE '2024-12-25'),
         (DATE '2025-01-01'), (DATE '2025-01-20'), (DATE '2025-02-17'), (DATE '2025-05-26'), (DATE '2025-06-19'), (DATE '2025-07-04'),
         (DATE '2025-09-01'), (DATE '2025-11-11'), (DATE '2025-11-27'), (DATE '2025-11-28'), (DATE '2025-12-25'),
         (DATE '2026-01-01'), (DATE '2026-01-19'), (DATE '2026-02-16'), (DATE '2026-05-25'), (DATE '2026-06-19'), (DATE '2026-07-03'),
         (DATE '2026-09-07'), (DATE '2026-11-11'), (DATE '2026-11-26'), (DATE '2026-11-27'), (DATE '2026-12-25')
), days AS (
  SELECT CAST(d AS DATE) AS d FROM range(DATE '2019-01-01', DATE '2027-01-01', INTERVAL 1 DAY) t(d)
)
SELECT CAST(strftime(d, '%Y%m%d') AS INTEGER) AS date_key, d AS date,
       year(d) AS year, quarter(d) AS quarter, month(d) AS month, CAST(date_trunc('month', d) AS DATE) AS month_start,
       CAST(date_trunc('quarter', d) AS DATE) AS quarter_start, concat('Q', quarter(d), ' ', year(d)) AS quarter_label,
       strftime(d, '%b %Y') AS month_label,
       concat('FY', CASE WHEN month(d) >= 7 THEN year(d) + 1 ELSE year(d) END) AS fiscal_year,
       concat('FY', CASE WHEN month(d) >= 7 THEN year(d) + 1 ELSE year(d) END, ' Q', CAST(floor(((month(d) + 5) % 12) / 3) + 1 AS INTEGER)) AS fiscal_quarter,
       isodow(d) AS iso_weekday, isodow(d) >= 6 AS is_weekend,
       d IN (SELECT h FROM holidays) AS is_holiday,
       isodow(d) < 6 AND d NOT IN (SELECT h FROM holidays) AS is_business_day
FROM days;
