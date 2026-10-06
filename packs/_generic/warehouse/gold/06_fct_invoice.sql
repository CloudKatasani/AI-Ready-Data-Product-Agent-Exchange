-- Receivable and payable invoices on one grain. Open invoices age to the as-of date.
CREATE OR REPLACE TABLE CONFORMED_GOLD.FCT_INVOICE AS
WITH inv AS (
  SELECT ar_invoice_id AS invoice_id, 'Receivable' AS ledger, entity_id, customer_id, NULL AS spend_category,
         invoice_date, due_date, paid_date, amount_usd, dispute_flag AS disputed
  FROM CURATED_SILVER.AR_INVOICE
  UNION ALL
  SELECT ap_invoice_id, 'Payable', entity_id, NULL, spend_category, invoice_date, due_date, paid_date, amount_usd, FALSE
  FROM CURATED_SILVER.AP_INVOICE
)
SELECT row_number() OVER (ORDER BY i.invoice_id) AS invoice_key, i.invoice_id, i.ledger, le.entity_key, c.customer_key,
       coalesce(i.spend_category, 'Customer sales') AS spend_category,
       CAST(strftime(i.invoice_date, '%Y%m%d') AS INTEGER) AS date_key, i.invoice_date, i.due_date, i.paid_date, i.amount_usd,
       i.paid_date IS NULL AS is_open,
       i.paid_date IS NULL AND i.due_date < GOVERNANCE.as_of() AS is_overdue,
       i.paid_date IS NOT NULL AND i.paid_date <= i.due_date AS paid_on_time,
       date_diff('day', i.invoice_date, coalesce(i.paid_date, GOVERNANCE.as_of())) AS days_to_settle,
       i.disputed
FROM inv i
JOIN CONFORMED_GOLD.DIM_LEGAL_ENTITY le ON le.entity_id = i.entity_id
LEFT JOIN CONFORMED_GOLD.DIM_CUSTOMER c ON c.customer_id = i.customer_id;
