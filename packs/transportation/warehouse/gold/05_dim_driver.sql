-- Driver dimension with home terminal region, employment status and tenure band (at separation, or at the reporting date).
-- full_name carries the driver id so namesakes never merge when a steward groups by driver.
CREATE OR REPLACE TABLE CONFORMED_GOLD.DIM_DRIVER AS
SELECT row_number() OVER (ORDER BY r.driver_id) AS driver_key, r.driver_id, r.first_name, r.last_name,
       concat(r.first_name, ' ', r.last_name, ' (', r.driver_id, ')') AS full_name, r.phone, t.terminal_key, t.region, r.driver_type,
       r.hire_date, r.separation_date, r.separation_reason, CASE WHEN r.active THEN 'Active' ELSE 'Separated' END AS status,
       CASE WHEN date_diff('month', r.hire_date, coalesce(r.separation_date, GOVERNANCE.as_of())) < 6 THEN 'Under 6 months'
            WHEN date_diff('month', r.hire_date, coalesce(r.separation_date, GOVERNANCE.as_of())) < 12 THEN '6 to 12 months'
            WHEN date_diff('month', r.hire_date, coalesce(r.separation_date, GOVERNANCE.as_of())) < 24 THEN '1 to 2 years'
            ELSE '2 years and over' END AS tenure_band
FROM CURATED_SILVER.DRIVER_ROSTER r
JOIN CONFORMED_GOLD.DIM_TERMINAL t ON t.terminal_id = r.home_terminal_id;
