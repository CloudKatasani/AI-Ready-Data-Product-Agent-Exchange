-- One row per invoice with its payment. Service revenue excludes device installments; written-off amounts are bad debt.
CREATE OR REPLACE TABLE CONFORMED_GOLD.FCT_BILLING AS
SELECT row_number() OVER (ORDER BY i.invoice_id) AS invoice_key, i.invoice_id, s.subscriber_key, p.plan_key, m.market_key,
       CAST(strftime(i.month_end, '%Y%m%d') AS INTEGER) AS date_key, i.month_end, i.segment,
       i.plan_charge, i.overage_amount, i.roaming_amount, i.rated_amount, i.leakage_amount, i.billed_amount,
       i.billed_amount AS service_revenue, i.device_installment, i.billed_amount + i.device_installment AS total_billed,
       coalesce(y.pay_method, 'Unpaid') AS pay_method, y.days_to_pay,
       CASE WHEN y.written_off THEN i.billed_amount + i.device_installment ELSE 0 END AS written_off_amount
FROM CURATED_SILVER.INVOICE i
JOIN CONFORMED_GOLD.DIM_SUBSCRIBER s ON s.subscriber_id = i.subscriber_id
JOIN CONFORMED_GOLD.DIM_PLAN p ON p.plan_id = i.plan_id
JOIN CONFORMED_GOLD.DIM_MARKET m ON m.market_id = i.market_id
LEFT JOIN CURATED_SILVER.PAYMENT y ON y.invoice_id = i.invoice_id;
