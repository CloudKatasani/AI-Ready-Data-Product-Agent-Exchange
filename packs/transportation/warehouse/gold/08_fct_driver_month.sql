-- One row per driver per month: miles driven and safety events from telematics and the safety register, plus
-- employment (headcount) and separation flags for turnover. Months with miles or events outside a driver's
-- employment (pool tractors logged against a former driver's id) keep their miles but add no headcount.
CREATE OR REPLACE TABLE CONFORMED_GOLD.FCT_DRIVER_MONTH AS
WITH months AS (
  SELECT DISTINCT month_start FROM CONFORMED_GOLD.DIM_DATE WHERE date BETWEEN DATE '2025-01-01' AND GOVERNANCE.as_of()
), employed AS (
  SELECT d.driver_id, m.month_start,
         d.separation_date IS NOT NULL AND CAST(date_trunc('month', d.separation_date) AS DATE) = m.month_start AS separated
  FROM CONFORMED_GOLD.DIM_DRIVER d
  JOIN months m ON d.hire_date <= last_day(m.month_start) AND (d.separation_date IS NULL OR d.separation_date >= m.month_start)
), miles AS (
  SELECT driver_id, CAST(date_trunc('month', activity_date) AS DATE) AS month_start, sum(total_miles) AS miles
  FROM CURATED_SILVER.FLEET_DAY GROUP BY ALL
), events AS (
  SELECT driver_id, CAST(date_trunc('month', event_date) AS DATE) AS month_start, count(*) AS safety_events,
         count(*) FILTER (WHERE dot_recordable) AS recordable_crashes, count(*) FILTER (WHERE preventable) AS preventable_crashes,
         count(*) FILTER (WHERE event_type = 'Hours-of-service violation') AS hos_violations
  FROM CURATED_SILVER.SAFETY_EVENT GROUP BY ALL
), grain AS (
  SELECT driver_id, month_start FROM employed UNION SELECT driver_id, month_start FROM miles UNION SELECT driver_id, month_start FROM events
)
SELECT row_number() OVER (ORDER BY g.driver_id, g.month_start) AS driver_month_key, d.driver_key, d.terminal_key,
       CAST(strftime(g.month_start, '%Y%m%d') AS INTEGER) AS date_key, g.month_start,
       e.driver_id IS NOT NULL AS employed, coalesce(e.separated, false) AS separated,
       coalesce(mi.miles, 0) AS miles, coalesce(ev.safety_events, 0) AS safety_events,
       coalesce(ev.recordable_crashes, 0) AS recordable_crashes, coalesce(ev.preventable_crashes, 0) AS preventable_crashes,
       coalesce(ev.hos_violations, 0) AS hos_violations
FROM grain g
JOIN CONFORMED_GOLD.DIM_DRIVER d ON d.driver_id = g.driver_id
LEFT JOIN employed e ON e.driver_id = g.driver_id AND e.month_start = g.month_start
LEFT JOIN miles mi ON mi.driver_id = g.driver_id AND mi.month_start = g.month_start
LEFT JOIN events ev ON ev.driver_id = g.driver_id AND ev.month_start = g.month_start
WHERE g.month_start BETWEEN DATE '2025-01-01' AND GOVERNANCE.as_of();
