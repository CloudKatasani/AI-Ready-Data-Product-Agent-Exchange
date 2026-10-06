CREATE OR REPLACE TABLE CONFORMED_GOLD.FCT_SUBMISSION AS
SELECT row_number() OVER (ORDER BY s.submission_id) AS submission_key, s.submission_id, a.agency_key,
       CAST(strftime(s.received_date, '%Y%m%d') AS INTEGER) AS date_key, s.received_date,
       s.line_of_business, s.submission_type, s.quoted, s.bound, s.turnaround_days, s.quoted_premium,
       CASE WHEN s.bound THEN s.quoted_premium ELSE 0 END AS bound_premium
FROM CURATED_SILVER.SUBMISSION s
JOIN CONFORMED_GOLD.DIM_AGENCY a ON a.agency_id = s.agency_id;
