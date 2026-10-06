CREATE OR REPLACE TABLE CURATED_SILVER.KYC_REVIEW AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.KYC_REVIEW
  QUALIFY row_number() OVER (PARTITION BY review_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT review_id, customer_id, review_date,
       CURATED_SILVER.canon(review_type, ['Periodic refresh', 'Event-driven', 'Onboarding']) AS review_type,
       CURATED_SILVER.canon(risk_rating, ['Low', 'Medium', 'High']) AS risk_rating,
       CURATED_SILVER.canon(outcome, ['Cleared', 'Enhanced due diligence', 'Exit recommended']) AS outcome,
       trim(analyst_notes) AS analyst_notes, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
