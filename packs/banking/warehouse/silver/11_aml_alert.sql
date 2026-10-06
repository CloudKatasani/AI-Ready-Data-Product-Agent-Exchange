-- Transaction-monitoring alerts: disposition decoded; SAR only counts on escalated, closed cases.
CREATE OR REPLACE TABLE CURATED_SILVER.AML_ALERT AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.AML_TM_ALERT
  QUALIFY row_number() OVER (PARTITION BY alert_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
), live AS (
  SELECT *, CURATED_SILVER.canon(disposition, ['Closed - no suspicion', 'Escalated to case', 'Pending review']) AS disp FROM latest WHERE _op <> 'D'
)
SELECT alert_id, customer_id, alert_date,
       CURATED_SILVER.canon(monitoring_scenario, ['Structuring', 'Rapid movement of funds', 'High-risk geography', 'Cash-intensive activity', 'Wire pattern anomaly']) AS monitoring_scenario,
       CURATED_SILVER.canon(priority, ['High', 'Medium', 'Low']) AS priority,
       disp AS disposition, disp <> 'Pending review' AS dispositioned, disp = 'Escalated to case' AS escalated,
       disp = 'Escalated to case' AND case_closed_flag AS case_closed,
       disp = 'Escalated to case' AND case_closed_flag AND sar_flag AS sar_filed,
       CASE WHEN disp <> 'Pending review' THEN disposition_days END AS days_to_disposition,
       trim(investigator_notes) AS investigator_notes, _loaded_at AS loaded_at
FROM live;
