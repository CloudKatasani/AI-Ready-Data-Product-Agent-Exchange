CREATE OR REPLACE TABLE CURATED_SILVER.BILLING_STATEMENT AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.BILL_STATEMENT
  QUALIFY row_number() OVER (PARTITION BY statement_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT statement_id, customer_no, statement_date, due_date, billed_amount, arrears_amount, estimated_flag, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
