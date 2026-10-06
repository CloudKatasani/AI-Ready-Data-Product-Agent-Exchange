CREATE OR REPLACE TABLE CONFORMED_GOLD.FCT_CONTACT AS
SELECT row_number() OVER (ORDER BY i.interaction_id) AS interaction_key, i.interaction_id, c.customer_key,
       CAST(strftime(CAST(i.interaction_ts AS DATE), '%Y%m%d') AS INTEGER) AS date_key, i.interaction_ts, i.channel, i.reason,
       i.handle_seconds, i.csat, i.agent_notes
FROM CURATED_SILVER.CONTACT_INTERACTION i
JOIN CONFORMED_GOLD.DIM_CUSTOMER c ON c.customer_no = i.customer_no;
