-- Month-end ARR per account and revenue stream (Subscription vs one-time Professional services), with the
-- prior month and the same month a year earlier for movement and trailing-twelve-month retention metrics.
-- Months are computed from 2023 so the 12-month lookback is complete for every reported month (2024-01 on).
CREATE OR REPLACE TABLE CONFORMED_GOLD.FCT_ARR_MONTHLY AS
WITH months AS (
  SELECT CAST(m + INTERVAL 1 MONTH - INTERVAL 1 DAY AS DATE) AS month_end
  FROM range(DATE '2023-01-01', DATE '2026-10-01', INTERVAL 1 MONTH) t(m)
), streams AS (
  SELECT * FROM (VALUES ('Subscription'), ('Professional services')) s(revenue_stream)
), grid AS (
  SELECT a.account_key, a.account_id, m.month_end, s.revenue_stream
  FROM CONFORMED_GOLD.DIM_ACCOUNT a CROSS JOIN months m CROSS JOIN streams s
  WHERE a.land_date <= m.month_end
), arr AS (
  SELECT g.account_key, g.month_end, g.revenue_stream, greatest(coalesce(sum(l.amount_usd), 0), 0) AS arr_usd
  FROM grid g
  LEFT JOIN CURATED_SILVER.SUBSCRIPTION_LINE l
    ON l.account_id = g.account_id AND l.revenue_stream = g.revenue_stream
   AND l.start_date <= g.month_end AND (l.end_date IS NULL OR l.end_date > g.month_end)
  GROUP BY g.account_key, g.month_end, g.revenue_stream
), lagged AS (
  SELECT *, coalesce(lag(arr_usd, 1) OVER w, 0) AS prev_usd, coalesce(lag(arr_usd, 12) OVER w, 0) AS ago_usd
  FROM arr
  WINDOW w AS (PARTITION BY account_key, revenue_stream ORDER BY month_end)
)
SELECT row_number() OVER (ORDER BY account_key, month_end, revenue_stream) AS arr_key, account_key,
       CAST(strftime(month_end, '%Y%m%d') AS INTEGER) AS date_key, month_end, revenue_stream,
       round(arr_usd, 2) AS arr_usd, round(prev_usd, 2) AS arr_prev_month_usd, round(ago_usd, 2) AS arr_12m_ago_usd,
       round(CASE WHEN prev_usd = 0 AND arr_usd > 0 THEN arr_usd ELSE 0 END, 2) AS new_arr_usd,
       round(CASE WHEN prev_usd > 0 AND arr_usd > prev_usd THEN arr_usd - prev_usd ELSE 0 END, 2) AS expansion_arr_usd,
       round(CASE WHEN arr_usd > 0 AND arr_usd < prev_usd THEN prev_usd - arr_usd ELSE 0 END, 2) AS contraction_arr_usd,
       round(CASE WHEN arr_usd = 0 AND prev_usd > 0 THEN prev_usd ELSE 0 END, 2) AS churned_arr_usd
FROM lagged
WHERE month_end >= DATE '2024-01-31' AND (arr_usd > 0 OR prev_usd > 0 OR ago_usd > 0);
