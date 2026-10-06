-- Invoice fact with the payment received against it (card numbers stay in Silver).
CREATE OR REPLACE TABLE CONFORMED_GOLD.FCT_INVOICE AS
WITH paid AS (SELECT invoice_id, sum(paid_amount) AS paid_amount FROM CURATED_SILVER.PAYMENT GROUP BY invoice_id)
SELECT row_number() OVER (ORDER BY i.invoice_id) AS invoice_key, i.invoice_id, p.policy_key,
       CAST(strftime(i.invoice_date, '%Y%m%d') AS INTEGER) AS date_key, i.invoice_date, i.amount_due,
       least(coalesce(pd.paid_amount, 0), i.amount_due) AS paid_amount, i.pay_method,
       i.pay_method LIKE 'Autopay%' AS autopay, i.days_past_due,
       CASE WHEN i.days_past_due > 90 THEN '90+ days' WHEN i.days_past_due > 60 THEN '61-90 days' WHEN i.days_past_due > 30 THEN '31-60 days' WHEN i.days_past_due > 0 THEN '1-30 days' ELSE 'Current' END AS dpd_bucket
FROM CURATED_SILVER.INVOICE i
JOIN CONFORMED_GOLD.DIM_POLICY p ON p.policy_id = i.policy_id
LEFT JOIN paid pd ON pd.invoice_id = i.invoice_id;
