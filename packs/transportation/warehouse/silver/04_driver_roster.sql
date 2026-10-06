-- Driver roster: deduplicated CDC, names title-cased, driver type conformed. A separation dated after the reporting
-- date is a resignation still serving notice (the driver is active); one dated within 14 days of hire (re-keyed rehire
-- records) is moved to 14 days after hire.
CREATE OR REPLACE TABLE CURATED_SILVER.DRIVER_ROSTER AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.HR_DRIVER
  QUALIFY row_number() OVER (PARTITION BY driver_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT driver_id, CURATED_SILVER.proper(first_name) AS first_name, CURATED_SILVER.proper(last_name) AS last_name,
       phone, cdl_number, home_terminal_id,
       CURATED_SILVER.canon(driver_type, ['Company', 'Owner-operator']) AS driver_type,
       hire_date,
       CASE WHEN separation_date IS NULL THEN NULL
            WHEN separation_date < hire_date + INTERVAL 14 DAY THEN CAST(least(hire_date + INTERVAL 14 DAY, GOVERNANCE.as_of()) AS DATE)
            ELSE separation_date END AS separation_date,
       CASE WHEN separation_date IS NULL THEN NULL
            ELSE CURATED_SILVER.canon(separation_reason, ['Voluntary - pay', 'Voluntary - home time', 'Voluntary - other carrier', 'Involuntary - safety', 'Involuntary - other']) END AS separation_reason,
       separation_date IS NULL AS active, _loaded_at AS loaded_at
FROM (SELECT * REPLACE (CASE WHEN separation_date > GOVERNANCE.as_of() THEN NULL ELSE separation_date END AS separation_date) FROM latest WHERE _op <> 'D');
