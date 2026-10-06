-- Claims that have been submitted (claims still being coded have no submit date yet).
CREATE OR REPLACE TABLE CURATED_SILVER.CLAIM_HEADER AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.PB_CLAIM
  QUALIFY row_number() OVER (PARTITION BY claim_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT claim_id, patient_mrn, facility_id, payer_id, service_date, submit_date,
       CURATED_SILVER.canon(claim_type, ['Professional', 'Institutional']) AS claim_type,
       charge_amount, expected_amount, scrubber_pass AS clean_claim, denied_flag AS denied,
       CASE WHEN denied_flag THEN CURATED_SILVER.canon(denial_reason, ['Authorization', 'Eligibility', 'Coding', 'Medical necessity', 'Timely filing', 'Duplicate claim']) ELSE 'Not denied' END AS denial_reason,
       _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D' AND submit_date IS NOT NULL;
