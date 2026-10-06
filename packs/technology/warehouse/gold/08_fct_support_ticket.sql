-- One row per support ticket with its first-response SLA target by priority (BR-TCH-011) and outcome.
CREATE OR REPLACE TABLE CONFORMED_GOLD.FCT_SUPPORT_TICKET AS
SELECT row_number() OVER (ORDER BY t.ticket_id) AS ticket_key, t.ticket_id, a.account_key, c.contact_key,
       CAST(strftime(t.created_date, '%Y%m%d') AS INTEGER) AS date_key, t.created_ts, t.priority, t.channel, t.category,
       t.ticket_status, t.first_response_minutes,
       CASE t.priority WHEN 'P1' THEN 30 WHEN 'P2' THEN 120 WHEN 'P3' THEN 480 ELSE 1440 END AS sla_target_minutes,
       t.first_response_minutes <= CASE t.priority WHEN 'P1' THEN 30 WHEN 'P2' THEN 120 WHEN 'P3' THEN 480 ELSE 1440 END AS sla_met,
       t.resolution_hours, t.csat_score,
       CASE WHEN t.csat_score IS NULL THEN NULL ELSE t.csat_score >= 4 END AS csat_satisfied
FROM CURATED_SILVER.SUPPORT_TICKET t
JOIN CONFORMED_GOLD.DIM_ACCOUNT a ON a.account_id = t.account_id
LEFT JOIN CONFORMED_GOLD.DIM_CONTACT c ON c.contact_id = t.contact_id;
