-- Support tickets: deduplicated, codes conformed, SLA hours derived from priority.
CREATE OR REPLACE TABLE CURATED_SILVER.SUPPORT_TICKET AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.SVC_TICKET
  QUALIFY row_number() OVER (PARTITION BY ticket_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
), conformed AS (
  SELECT ticket_id, customer_id, opened_ts, CAST(opened_ts AS DATE) AS ticket_date,
         CURATED_SILVER.canon(channel, ['Email', 'Phone', 'Chat', 'Portal']) AS channel,
         CURATED_SILVER.canon(priority, ['P1', 'P2', 'P3', 'P4']) AS priority,
         CURATED_SILVER.canon(category, ['Billing', 'Product issue', 'How-to', 'Account access', 'Delivery']) AS category,
         CURATED_SILVER.canon(ticket_status, ['Resolved', 'Auto-closed spam']) AS ticket_status,
         resolution_hours, first_contact_resolved, csat, trim(agent_notes) AS agent_notes, _loaded_at AS loaded_at
  FROM latest WHERE _op <> 'D'
)
SELECT *, CASE priority WHEN 'P1' THEN 4 WHEN 'P2' THEN 24 WHEN 'P3' THEN 72 ELSE 120 END AS sla_hours
FROM conformed;
