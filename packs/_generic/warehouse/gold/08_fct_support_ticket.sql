-- One row per support ticket with SLA outcome and, where the customer answered the survey, the NPS score.
CREATE OR REPLACE TABLE CONFORMED_GOLD.FCT_SUPPORT_TICKET AS
SELECT row_number() OVER (ORDER BY t.ticket_id) AS ticket_key, t.ticket_id, c.customer_key,
       CAST(strftime(t.ticket_date, '%Y%m%d') AS INTEGER) AS date_key, t.opened_ts, t.ticket_date,
       t.channel, t.priority, t.category, t.ticket_status = 'Auto-closed spam' AS auto_closed_spam,
       t.resolution_hours, t.sla_hours, t.resolution_hours > t.sla_hours AS sla_breached,
       t.first_contact_resolved, t.csat, s.nps_score,
       CASE WHEN s.nps_score >= 9 THEN 'Promoter' WHEN s.nps_score >= 7 THEN 'Passive' WHEN s.nps_score IS NOT NULL THEN 'Detractor' END AS nps_group,
       t.agent_notes
FROM CURATED_SILVER.SUPPORT_TICKET t
JOIN CONFORMED_GOLD.DIM_CUSTOMER c ON c.customer_id = t.customer_id
LEFT JOIN CURATED_SILVER.SURVEY_RESPONSE s ON s.ticket_id = t.ticket_id;
