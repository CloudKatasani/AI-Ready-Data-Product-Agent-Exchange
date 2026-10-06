-- Benefit payments: improper, overpayment and recovered amounts derived; QC and integrity attributes only
-- where a finding or flag exists.
CREATE OR REPLACE TABLE CURATED_SILVER.BENEFIT_PAYMENT AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.BEN_PAYMENT
  QUALIFY row_number() OVER (PARTITION BY payment_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
), typed AS (
  SELECT payment_id, case_id, CURATED_SILVER.canon(program_code, ['FA', 'CA', 'MA', 'CCS', 'EA']) AS program_code, region,
         issue_date, amount, is_improper, improper_ratio,
         CURATED_SILVER.canon(error_type, ['Income verification', 'Household composition', 'Administrative error', 'Duplicate issuance']) AS error_type,
         issued_on_time, CURATED_SILVER.canon(payment_status, ['Issued', 'Voided']) AS payment_status, integrity_flag,
         CURATED_SILVER.canon(flag_reason, ['Unreported income match', 'Duplicate participation', 'Address outside county', 'Identity verification', 'Employment data match']) AS flag_reason,
         CURATED_SILVER.canon(flag_status, ['Open review', 'Referred', 'Overpayment established', 'Cleared']) AS flag_status,
         recovery_ratio, _loaded_at
  FROM latest WHERE _op <> 'D'
)
SELECT payment_id, case_id, program_code, region, issue_date, amount, is_improper, improper_ratio,
       CASE WHEN is_improper THEN round(amount * improper_ratio, 2) ELSE 0 END AS improper_amount,
       CASE WHEN is_improper THEN error_type END AS error_type,
       issued_on_time, payment_status, integrity_flag,
       CASE WHEN integrity_flag THEN flag_reason END AS flag_reason,
       CASE WHEN integrity_flag THEN flag_status END AS flag_status,
       CASE WHEN integrity_flag AND flag_status = 'Overpayment established' THEN round(amount * 0.8, 2) ELSE 0 END AS overpayment_amount,
       CASE WHEN integrity_flag AND flag_status = 'Overpayment established' THEN round(amount * 0.8 * recovery_ratio, 2) ELSE 0 END AS recovered_amount,
       _loaded_at AS loaded_at
FROM typed;
