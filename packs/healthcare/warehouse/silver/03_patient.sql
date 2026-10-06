-- Patient master: deduplicated CDC, names title-cased, codes conformed, status/portal decoded, SSN normalised.
CREATE OR REPLACE TABLE CURATED_SILVER.PATIENT AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.EMPI_PATIENT
  QUALIFY row_number() OVER (PARTITION BY mrn ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT mrn,
       CURATED_SILVER.proper(first_name) AS first_name, CURATED_SILVER.proper(last_name) AS last_name,
       date_of_birth, CURATED_SILVER.canon(sex, ['F', 'M']) AS sex, lpad(CAST(ssn AS VARCHAR), 9, '0') AS ssn,
       lower(trim(email)) AS email, phone, CURATED_SILVER.proper(street_address) AS street_address,
       home_facility_id, CURATED_SILVER.canon(region, ['Metro', 'Lakeshore', 'Riverside', 'Valley', 'Highland']) AS region,
       CURATED_SILVER.canon(payer_class, ['Medicare', 'Medicaid', 'Commercial', 'Self-pay']) AS payer_class,
       CASE status_code WHEN 'A' THEN 'Active' ELSE 'Inactive' END AS status,
       portal_flag = 'Y' AS portal_enrolled, risk_score, registered_date, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
