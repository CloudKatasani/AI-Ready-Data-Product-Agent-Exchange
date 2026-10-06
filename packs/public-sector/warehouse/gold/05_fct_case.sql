-- One row per program case; backlog = open case with an application, renewal or change awaiting a decision.
CREATE OR REPLACE TABLE CONFORMED_GOLD.FCT_CASE AS
SELECT row_number() OVER (ORDER BY c.case_id) AS case_key, c.case_id, k.constituent_key, o.office_key, o.region,
       c.program_code,
       CASE c.program_code WHEN 'FA' THEN 'Food Assistance' WHEN 'CA' THEN 'Cash Assistance' WHEN 'MA' THEN 'Medical Assistance'
            WHEN 'CCS' THEN 'Child Care Subsidy' ELSE 'Energy Assistance' END AS program_name,
       c.caseworker_name, c.opened_date, c.case_status, c.pending_action,
       c.case_status = 'Open' AND c.pending_action <> 'None' AS in_backlog,
       c.pending_days,
       CASE WHEN c.pending_days IS NULL THEN NULL WHEN c.pending_days <= 30 THEN '0-30 days' WHEN c.pending_days <= 60 THEN '31-60 days' ELSE 'Over 60 days' END AS backlog_age_band
FROM CURATED_SILVER.CASE_RECORD c
JOIN CONFORMED_GOLD.DIM_OFFICE o ON o.office_id = c.office_id
LEFT JOIN CONFORMED_GOLD.DIM_CONSTITUENT k ON k.constituent_id = c.constituent_id;
