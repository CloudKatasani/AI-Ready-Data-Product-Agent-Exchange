-- Street maintenance work orders: completed when the repair finished by the reporting date.
CREATE OR REPLACE TABLE CURATED_SILVER.STREET_WORK_ORDER AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.PW_WORK_ORDER
  QUALIFY row_number() OVER (PARTITION BY work_order_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
), typed AS (
  SELECT work_order_id, segment_id, region,
         CURATED_SILVER.canon(work_type, ['Pothole repair', 'Crack seal', 'Streetlight repair', 'Sign replacement', 'Storm drain cleaning', 'Sidewalk repair']) AS work_type,
         reported_date, repair_days, CURATED_SILVER.canon(crew_type, ['County crew', 'Contractor']) AS crew_type,
         labor_hours, cost_usd, CURATED_SILVER.proper(crew_lead) AS crew_lead,
         CAST(reported_date + to_days(CAST(ceil(repair_days) AS INTEGER)) AS DATE) AS done_on, _loaded_at
  FROM latest WHERE _op <> 'D'
)
SELECT work_order_id, segment_id, region, work_type, reported_date,
       CASE WHEN done_on <= GOVERNANCE.as_of() THEN done_on END AS completed_date,
       CASE WHEN done_on <= GOVERNANCE.as_of() THEN repair_days END AS repair_days,
       crew_type, labor_hours, cost_usd, crew_lead, _loaded_at AS loaded_at
FROM typed;
