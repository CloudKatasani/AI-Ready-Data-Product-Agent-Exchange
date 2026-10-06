CREATE OR REPLACE TABLE CONFORMED_GOLD.DIM_PAYER AS
SELECT row_number() OVER (ORDER BY payer_id) AS payer_key, payer_id, payer_name, financial_class,
       CASE WHEN financial_class IN ('Medicare', 'Medicaid') THEN 'Government' WHEN financial_class = 'Self-pay' THEN 'Self-pay' ELSE 'Managed care' END AS payer_group,
       tax_id, contact_email
FROM CURATED_SILVER.PAYER;
