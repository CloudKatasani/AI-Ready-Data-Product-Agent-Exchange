CREATE OR REPLACE TABLE CURATED_SILVER.COMPLAINT AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.CRM_COMPLAINT
  QUALIFY row_number() OVER (PARTITION BY complaint_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT complaint_id, customer_id, received_date,
       CURATED_SILVER.canon(product_area, ['Deposits', 'Cards', 'Mortgage', 'Consumer lending', 'Digital banking', 'Branch service']) AS product_area,
       CURATED_SILVER.canon(category, ['Fees & charges', 'Service quality', 'Error or dispute', 'Fraud & security', 'Access & availability']) AS category,
       resolution_days, regulator_escalated, trim(complaint_notes) AS complaint_notes, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
