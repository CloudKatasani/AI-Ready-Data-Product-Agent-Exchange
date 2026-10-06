CREATE OR REPLACE TABLE CONFORMED_GOLD.FCT_COMPLAINT AS
SELECT row_number() OVER (ORDER BY m.complaint_id) AS complaint_key, m.complaint_id, c.customer_key,
       CAST(strftime(m.received_date, '%Y%m%d') AS INTEGER) AS date_key, m.received_date, m.product_area, m.category,
       m.resolution_days, m.resolution_days <= 15 AS resolved_within_sla, m.regulator_escalated
FROM CURATED_SILVER.COMPLAINT m
JOIN CONFORMED_GOLD.DIM_CUSTOMER c ON c.customer_id = m.customer_id;
