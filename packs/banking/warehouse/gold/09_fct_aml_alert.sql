-- Alert fact; subject name and address are carried for investigators (masking policy MASK_PII).
CREATE OR REPLACE TABLE CONFORMED_GOLD.FCT_AML_ALERT AS
SELECT row_number() OVER (ORDER BY a.alert_id) AS alert_key, a.alert_id, c.customer_key,
       CAST(strftime(a.alert_date, '%Y%m%d') AS INTEGER) AS date_key, a.alert_date, a.monitoring_scenario, a.priority,
       a.disposition, a.dispositioned, a.escalated, a.case_closed, a.sar_filed, a.days_to_disposition,
       c.full_name AS subject_name, c.street_address AS subject_address
FROM CURATED_SILVER.AML_ALERT a
JOIN CONFORMED_GOLD.DIM_CUSTOMER c ON c.customer_id = a.customer_id;
