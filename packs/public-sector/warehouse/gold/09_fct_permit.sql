-- One row per permit with review turnaround against the track's target and inspection outcomes.
-- date_key is the decision (issue or denial) date.
CREATE OR REPLACE TABLE CONFORMED_GOLD.FCT_PERMIT AS
WITH insp AS (
  SELECT permit_id, count(*) AS inspections, count_if(result = 'Fail') AS failed_inspections,
         arg_min(result, inspection_id) = 'Pass' AS first_inspection_passed
  FROM CURATED_SILVER.PERMIT_INSPECTION
  GROUP BY permit_id
)
SELECT row_number() OVER (ORDER BY p.permit_id) AS permit_key, p.permit_id,
       CAST(strftime(p.decision_date, '%Y%m%d') AS INTEGER) AS date_key, p.submitted_date, p.decision_date,
       p.region, p.permit_type, p.review_track, p.status, p.status = 'Issued' AS issued,
       p.review_days,
       CASE p.review_track WHEN 'Over the counter' THEN 1 WHEN 'Standard' THEN 20 ELSE 45 END AS target_days,
       CASE WHEN p.review_days IS NULL THEN NULL ELSE p.review_days <= CASE p.review_track WHEN 'Over the counter' THEN 1 WHEN 'Standard' THEN 20 ELSE 45 END END AS within_target,
       p.valuation_usd, round(85 + p.valuation_usd * 0.011, 2) AS permit_fee,
       coalesce(i.inspections, 0) AS inspections, coalesce(i.failed_inspections, 0) AS failed_inspections, i.first_inspection_passed,
       p.applicant_name, p.applicant_email
FROM CURATED_SILVER.PERMIT_APPLICATION p
LEFT JOIN insp i ON i.permit_id = p.permit_id;
