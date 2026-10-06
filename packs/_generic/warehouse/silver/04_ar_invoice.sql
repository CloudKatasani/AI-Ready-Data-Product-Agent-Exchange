-- Customer invoices. A payment dated after the as-of date has not happened yet, so it is treated as open.
CREATE OR REPLACE TABLE CURATED_SILVER.AR_INVOICE AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.ERP_AR_INVOICE
  QUALIFY row_number() OVER (PARTITION BY ar_invoice_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT ar_invoice_id, customer_id, entity_id, invoice_date, due_date, amount_usd, dispute_flag,
       CASE WHEN paid_date <= GOVERNANCE.as_of() THEN paid_date END AS paid_date,
       CURATED_SILVER.canon(payment_method, ['Bank transfer', 'Direct debit', 'Card', 'Cheque']) AS payment_method,
       _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
