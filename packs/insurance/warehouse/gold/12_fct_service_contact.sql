-- Service contact fact with the survey score when the contact was surveyed.
CREATE OR REPLACE TABLE CONFORMED_GOLD.FCT_SERVICE_CONTACT AS
SELECT row_number() OVER (ORDER BY s.contact_id) AS contact_key, s.contact_id, s.contact_ts, h.policyholder_key,
       CAST(strftime(s.contact_date, '%Y%m%d') AS INTEGER) AS date_key, s.contact_date, s.contact_channel, s.contact_reason,
       s.contact_reason = 'Complaint' AS complaint, s.first_contact_resolved, s.handle_minutes,
       n.score AS nps_score, n.nps_category
FROM CURATED_SILVER.SERVICE_CONTACT s
JOIN CONFORMED_GOLD.DIM_POLICYHOLDER h ON h.policyholder_id = s.policyholder_id
LEFT JOIN CURATED_SILVER.NPS_SURVEY n ON n.contact_id = s.contact_id;
