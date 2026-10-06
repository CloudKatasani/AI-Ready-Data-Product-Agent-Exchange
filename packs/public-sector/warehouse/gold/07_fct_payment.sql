-- One row per benefit payment with quality-control and program-integrity outcomes. case_gov_id carries the case
-- head's government identifier for data matching (GOV_ID).
CREATE OR REPLACE TABLE CONFORMED_GOLD.FCT_PAYMENT AS
SELECT row_number() OVER (ORDER BY p.payment_id) AS payment_key, p.payment_id, c.case_key, c.constituent_key,
       CAST(strftime(p.issue_date, '%Y%m%d') AS INTEGER) AS date_key, p.issue_date, c.region,
       c.program_name, p.amount AS payment_amount, p.is_improper, p.improper_amount, p.error_type, p.issued_on_time,
       p.payment_status, p.integrity_flag, p.flag_reason, p.flag_status,
       coalesce(p.flag_status IN ('Open review', 'Referred'), false) AS flagged_for_review,
       p.overpayment_amount, p.recovered_amount, k.gov_id AS case_gov_id
FROM CURATED_SILVER.BENEFIT_PAYMENT p
JOIN CONFORMED_GOLD.FCT_CASE c ON c.case_id = p.case_id
LEFT JOIN CONFORMED_GOLD.DIM_CONSTITUENT k ON k.constituent_key = c.constituent_key;
