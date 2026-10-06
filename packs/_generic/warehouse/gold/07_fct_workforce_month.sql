-- One row per employee per month employed (Jan 2024 to the as-of month): joiners, leavers and time to fill.
CREATE OR REPLACE TABLE CONFORMED_GOLD.FCT_WORKFORCE_MONTH AS
WITH months AS (
  SELECT CAST(m AS DATE) AS month_start, CAST(m + INTERVAL 1 MONTH - INTERVAL 1 DAY AS DATE) AS month_end
  FROM range(DATE '2024-01-01', CAST(date_trunc('month', GOVERNANCE.as_of()) AS DATE) + INTERVAL 1 DAY, INTERVAL 1 MONTH) t(m)
)
SELECT row_number() OVER (ORDER BY e.employee_id, m.month_start) AS employee_month_key, e.employee_key, e.entity_key,
       CAST(strftime(m.month_start, '%Y%m%d') AS INTEGER) AS date_key, m.month_start,
       e.department, e.job_level, e.employment_type, e.fte,
       e.hire_date < m.month_start AS active_at_start,
       e.termination_date IS NULL OR e.termination_date > m.month_end AS active_at_end,
       coalesce(e.termination_date BETWEEN m.month_start AND m.month_end, FALSE) AS is_leaver,
       coalesce(e.termination_date BETWEEN m.month_start AND m.month_end AND e.termination_type = 'Voluntary', FALSE) AS is_voluntary_leaver,
       e.hire_date BETWEEN m.month_start AND m.month_end AS is_hire,
       CASE WHEN e.hire_date BETWEEN m.month_start AND m.month_end THEN r.time_to_fill_days END AS time_to_fill_days,
       CASE WHEN e.hire_date BETWEEN m.month_start AND m.month_end THEN coalesce(r.hire_source, 'External') END AS hire_source
FROM CONFORMED_GOLD.DIM_EMPLOYEE e
JOIN months m ON e.hire_date <= m.month_end AND (e.termination_date IS NULL OR e.termination_date >= m.month_start)
LEFT JOIN CURATED_SILVER.REQUISITION r ON r.hired_employee_id = e.employee_id;
