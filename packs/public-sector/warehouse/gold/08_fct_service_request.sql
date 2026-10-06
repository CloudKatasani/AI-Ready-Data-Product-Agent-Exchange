-- One row per 311 request; on time when closed within the SLA for its request type.
CREATE OR REPLACE TABLE CONFORMED_GOLD.FCT_SERVICE_REQUEST AS
SELECT row_number() OVER (ORDER BY sr_id) AS sr_key, sr_id,
       CAST(strftime(CAST(created_ts AS DATE), '%Y%m%d') AS INTEGER) AS date_key, created_ts, closed_ts,
       region, request_type, department, channel, sla_days, status, status = 'Closed' AS closed,
       resolution_days,
       CASE WHEN status = 'Closed' THEN resolution_days <= sla_days END AS within_sla,
       is_duplicate, reopened, survey_score, caller_name
FROM CURATED_SILVER.SERVICE_REQUEST;
