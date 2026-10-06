CREATE OR REPLACE TABLE CONFORMED_GOLD.FCT_CARE_CONTACT AS
SELECT row_number() OVER (ORDER BY c.contact_id) AS contact_key, c.contact_id, m.member_key,
       CAST(strftime(CAST(c.contact_ts AS DATE), '%Y%m%d') AS INTEGER) AS date_key, c.contact_ts, c.channel, c.reason,
       c.handle_seconds, c.csat, c.agent_notes
FROM CURATED_SILVER.CARE_CONTACT c
JOIN CONFORMED_GOLD.DIM_MEMBER m ON m.member_id = c.member_id;
