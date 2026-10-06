-- Permit applications: types and review tracks conformed; decision date derived from review days.
CREATE OR REPLACE TABLE CURATED_SILVER.PERMIT_APPLICATION AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.PRM_APPLICATION
  QUALIFY row_number() OVER (PARTITION BY permit_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
), typed AS (
  SELECT permit_id,
         CURATED_SILVER.canon(permit_type, ['Residential building', 'Commercial building', 'Electrical', 'Plumbing', 'Mechanical', 'Demolition', 'Sign', 'Right-of-way']) AS permit_type,
         CURATED_SILVER.canon(review_track, ['Over the counter', 'Standard', 'Major']) AS review_track,
         CURATED_SILVER.canon(region, ['North', 'Central', 'South', 'Riverside']) AS region,
         submitted_date, review_days, CURATED_SILVER.canon(outcome, ['Issued', 'Denied', 'Withdrawn']) AS outcome,
         valuation_usd, CURATED_SILVER.proper(applicant_name) AS applicant_name, lower(applicant_email) AS applicant_email,
         CAST(submitted_date + to_days(review_days) AS DATE) AS decided_on, _loaded_at
  FROM latest WHERE _op <> 'D'
)
SELECT permit_id, permit_type, review_track, region, submitted_date,
       CASE WHEN decided_on <= GOVERNANCE.as_of() THEN decided_on END AS decision_date,
       CASE WHEN decided_on <= GOVERNANCE.as_of() THEN review_days END AS review_days,
       CASE WHEN decided_on <= GOVERNANCE.as_of() THEN outcome ELSE 'In review' END AS status,
       valuation_usd, applicant_name, applicant_email, _loaded_at AS loaded_at
FROM typed;
