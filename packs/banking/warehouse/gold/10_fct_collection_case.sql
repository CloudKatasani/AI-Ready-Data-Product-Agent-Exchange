CREATE OR REPLACE TABLE CONFORMED_GOLD.FCT_COLLECTION_CASE AS
SELECT row_number() OVER (ORDER BY k.case_id) AS case_key, k.case_id, l.loan_key, c.customer_key,
       CAST(strftime(k.entry_date, '%Y%m%d') AS INTEGER) AS date_key, k.entry_date, k.entry_bucket, l.loan_segment, k.strategy,
       k.ptp_made, k.ptp_kept, k.outcome, k.case_closed, k.outcome = 'Cured' AS cured, k.outcome = 'Charged off' AS charged_off,
       k.days_to_resolve, k.recovered_amount, k.collector_name
FROM CURATED_SILVER.COLLECTION_CASE k
JOIN CONFORMED_GOLD.DIM_LOAN l ON l.loan_id = k.loan_id
JOIN CONFORMED_GOLD.DIM_CUSTOMER c ON c.customer_id = k.customer_id;
