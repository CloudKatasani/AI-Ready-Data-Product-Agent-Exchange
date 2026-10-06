CREATE OR REPLACE TABLE CURATED_SILVER.PAYER AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.PM_PAYER
  QUALIFY row_number() OVER (PARTITION BY payer_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT payer_id, CURATED_SILVER.proper(payer_name) AS payer_name,
       CURATED_SILVER.canon(financial_class, ['Medicare', 'Medicare Advantage', 'Medicaid', 'Managed Medicaid', 'Commercial', 'Self-pay']) AS financial_class,
       tax_id, lower(contact_email) AS contact_email, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
