-- Supplier invoices: supplier names title-cased, spend categories conformed, future payments treated as open.
CREATE OR REPLACE TABLE CURATED_SILVER.AP_INVOICE AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.ERP_AP_INVOICE
  QUALIFY row_number() OVER (PARTITION BY ap_invoice_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT ap_invoice_id, CURATED_SILVER.proper(supplier_name) AS supplier_name, entity_id,
       CURATED_SILVER.canon(spend_category, ['Raw materials', 'Logistics', 'IT & software', 'Facilities', 'Professional services', 'Marketing services']) AS spend_category,
       invoice_date, due_date, amount_usd,
       CASE WHEN paid_date <= GOVERNANCE.as_of() THEN paid_date END AS paid_date, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
