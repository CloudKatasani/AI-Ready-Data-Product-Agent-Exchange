CREATE OR REPLACE TABLE CONFORMED_GOLD.DIM_LOAN AS
SELECT row_number() OVER (ORDER BY l.loan_id) AS loan_key, l.loan_id, c.customer_key, b.branch_key, l.loan_segment,
       CASE WHEN l.loan_segment IN ('Commercial real estate', 'Commercial & industrial') THEN 'Commercial' ELSE 'Consumer' END AS segment_group,
       l.orig_date, year(l.orig_date) AS vintage_year, l.orig_amount, l.note_rate_pct, l.fico_score,
       CASE WHEN l.fico_score < 620 THEN 'Subprime (<620)' WHEN l.fico_score < 680 THEN 'Near prime (620-679)' WHEN l.fico_score < 740 THEN 'Prime (680-739)' ELSE 'Super prime (740+)' END AS fico_band,
       l.ltv_pct, CASE WHEN l.ltv_pct > 90 THEN 'Above 90%' WHEN l.ltv_pct > 80 THEN '80-90%' ELSE '80% or below' END AS ltv_band,
       l.held_for_sale
FROM CURATED_SILVER.LOAN l
JOIN CONFORMED_GOLD.DIM_CUSTOMER c ON c.customer_id = l.customer_id
LEFT JOIN CONFORMED_GOLD.DIM_BRANCH b ON b.branch_id = l.branch_id;
