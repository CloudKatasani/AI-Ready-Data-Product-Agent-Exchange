-- Helpdesk tickets: deduplicated, tombstones removed, priority/channel/category/status conformed.
CREATE OR REPLACE TABLE CURATED_SILVER.SUPPORT_TICKET AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.HELPDESK_TICKET
  QUALIFY row_number() OVER (PARTITION BY ticket_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT ticket_id, contact_id, account_id, created_ts, CAST(created_ts AS DATE) AS created_date,
       CURATED_SILVER.canon(priority, ['P1', 'P2', 'P3', 'P4']) AS priority,
       CURATED_SILVER.canon(channel, ['Email', 'Web portal', 'Chat', 'Phone']) AS channel,
       CURATED_SILVER.canon(category, ['How-to', 'Bug', 'Billing', 'Integration', 'Access & SSO', 'Performance']) AS category,
       CURATED_SILVER.canon(status, ['Solved', 'Closed', 'Open', 'Merged']) AS ticket_status,
       first_response_minutes, resolution_hours, csat_score, trim(subject) AS subject, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
