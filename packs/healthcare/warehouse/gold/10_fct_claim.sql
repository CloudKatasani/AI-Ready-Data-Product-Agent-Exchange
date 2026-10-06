-- Claims with remittances received within 60 days of submission.
CREATE OR REPLACE TABLE CONFORMED_GOLD.FCT_CLAIM AS
WITH paid AS (
  SELECT r.claim_id, sum(r.paid_amount) AS paid_60d, min(date_diff('day', c.submit_date, r.payment_date)) AS days_to_pay
  FROM CURATED_SILVER.REMITTANCE r
  JOIN CURATED_SILVER.CLAIM_HEADER c ON c.claim_id = r.claim_id
  WHERE r.payment_date <= c.submit_date + INTERVAL 60 DAY
  GROUP BY r.claim_id
)
SELECT row_number() OVER (ORDER BY c.claim_id) AS claim_key, c.claim_id, p.patient_key, y.payer_key, f.facility_key,
       CAST(strftime(c.submit_date, '%Y%m%d') AS INTEGER) AS date_key, c.service_date, c.submit_date, c.claim_type,
       c.charge_amount, c.expected_amount, c.clean_claim, c.denied, c.denial_reason,
       c.submit_date <= GOVERNANCE.as_of() - INTERVAL 60 DAY AS mature,
       round(least(coalesce(pd.paid_60d, 0), c.expected_amount), 2) AS paid_60d_amount,
       pd.days_to_pay
FROM CURATED_SILVER.CLAIM_HEADER c
JOIN CONFORMED_GOLD.DIM_PATIENT p ON p.mrn = c.patient_mrn
JOIN CONFORMED_GOLD.DIM_PAYER y ON y.payer_id = c.payer_id
JOIN CONFORMED_GOLD.DIM_FACILITY f ON f.facility_id = c.facility_id
LEFT JOIN paid pd ON pd.claim_id = c.claim_id;
