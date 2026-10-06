-- 311 service requests: request types conformed, routed to departments with their SLA; requests not
-- resolved by the reporting date are Open.
CREATE OR REPLACE TABLE CURATED_SILVER.SERVICE_REQUEST AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.SR311_REQUEST
  QUALIFY row_number() OVER (PARTITION BY sr_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
), typed AS (
  SELECT sr_id,
         CURATED_SILVER.canon(request_type, ['Pothole', 'Missed trash pickup', 'Streetlight out', 'Graffiti removal', 'Noise complaint', 'Benefits inquiry', 'Abandoned vehicle', 'Water leak', 'Tree or debris', 'Housing inspection']) AS request_type,
         CURATED_SILVER.canon(channel, ['Phone', 'Mobile app', 'Web', 'Walk-in']) AS channel,
         CURATED_SILVER.canon(region, ['North', 'Central', 'South', 'Riverside']) AS region,
         created_ts, resolution_days, is_duplicate, reopened, survey_score,
         CURATED_SILVER.proper(caller_name) AS caller_name, _loaded_at,
         created_ts + to_seconds(CAST(round(resolution_days * 86400) AS BIGINT)) AS resolved_ts
  FROM latest WHERE _op <> 'D'
)
SELECT sr_id, request_type,
       CASE request_type WHEN 'Pothole' THEN 'Public Works' WHEN 'Streetlight out' THEN 'Public Works'
            WHEN 'Missed trash pickup' THEN 'Solid Waste' WHEN 'Graffiti removal' THEN 'Parks & Facilities'
            WHEN 'Tree or debris' THEN 'Parks & Facilities' WHEN 'Benefits inquiry' THEN 'Eligibility Services'
            WHEN 'Water leak' THEN 'Water Utility' ELSE 'Code Enforcement' END AS department,
       CASE request_type WHEN 'Pothole' THEN 5 WHEN 'Missed trash pickup' THEN 2 WHEN 'Streetlight out' THEN 7
            WHEN 'Graffiti removal' THEN 5 WHEN 'Noise complaint' THEN 3 WHEN 'Benefits inquiry' THEN 2
            WHEN 'Abandoned vehicle' THEN 10 WHEN 'Water leak' THEN 1 WHEN 'Tree or debris' THEN 7 ELSE 14 END AS sla_days,
       channel, region, created_ts,
       CASE WHEN resolved_ts < CAST(GOVERNANCE.as_of() AS TIMESTAMP) + INTERVAL 1 DAY THEN resolved_ts END AS closed_ts,
       CASE WHEN resolved_ts < CAST(GOVERNANCE.as_of() AS TIMESTAMP) + INTERVAL 1 DAY THEN resolution_days END AS resolution_days,
       CASE WHEN resolved_ts < CAST(GOVERNANCE.as_of() AS TIMESTAMP) + INTERVAL 1 DAY THEN 'Closed' ELSE 'Open' END AS status,
       is_duplicate, reopened, survey_score, caller_name, _loaded_at AS loaded_at
FROM typed;
