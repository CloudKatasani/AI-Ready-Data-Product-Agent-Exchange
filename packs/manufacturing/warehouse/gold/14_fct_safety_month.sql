-- One row per plant and month since January 2025: hours worked (headcount × standard monthly hours, a little
-- lower in the August and December shutdown months) and incidents by severity. Lost-time incidents are also
-- recordable (OSHA-style definitions, BR-MFG-022).
CREATE OR REPLACE TABLE CONFORMED_GOLD.FCT_SAFETY_MONTH AS
WITH months AS (
  SELECT CAST(m AS DATE) AS month_start FROM range(DATE '2025-01-01', DATE '2026-10-01', INTERVAL 1 MONTH) t(m)
), incidents AS (
  SELECT plant_id, CAST(date_trunc('month', incident_date) AS DATE) AS month_start,
         count(*) FILTER (WHERE severity IN ('Recordable', 'Lost time')) AS recordable_incidents,
         count(*) FILTER (WHERE severity = 'Lost time') AS lost_time_incidents,
         count(*) FILTER (WHERE severity = 'First aid') AS first_aid_cases,
         count(*) FILTER (WHERE severity = 'Near miss') AS near_misses
  FROM CURATED_SILVER.SAFETY_INCIDENT GROUP BY ALL
)
SELECT row_number() OVER (ORDER BY p.plant_id, m.month_start) AS safety_key, p.plant_key, p.plant_id,
       CAST(strftime(m.month_start, '%Y%m%d') AS INTEGER) AS date_key, m.month_start,
       p.headcount * CASE WHEN month(m.month_start) IN (8, 12) THEN 148 ELSE 164 END AS hours_worked,
       coalesce(i.recordable_incidents, 0) AS recordable_incidents, coalesce(i.lost_time_incidents, 0) AS lost_time_incidents,
       coalesce(i.first_aid_cases, 0) AS first_aid_cases, coalesce(i.near_misses, 0) AS near_misses
FROM CONFORMED_GOLD.DIM_PLANT p
CROSS JOIN months m
LEFT JOIN incidents i ON i.plant_id = p.plant_id AND i.month_start = m.month_start;
