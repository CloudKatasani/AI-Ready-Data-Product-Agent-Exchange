-- Submissions: bound only when quoted; turnaround only for quoted submissions.
CREATE OR REPLACE TABLE CURATED_SILVER.SUBMISSION AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.UW_SUBMISSION
  QUALIFY row_number() OVER (PARTITION BY submission_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT submission_id, agency_id, received_date,
       CURATED_SILVER.canon(line_of_business, ['Personal Auto', 'Homeowners', 'Commercial Auto', 'Commercial Property', 'General Liability', 'Workers Compensation']) AS line_of_business,
       CURATED_SILVER.canon(submission_type, ['New business', 'Rewrite', 'Reinstatement']) AS submission_type,
       quoted_flag AS quoted, quoted_flag AND bind_flag AS bound,
       CASE WHEN quoted_flag THEN turnaround_days END AS turnaround_days,
       quoted_premium, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
