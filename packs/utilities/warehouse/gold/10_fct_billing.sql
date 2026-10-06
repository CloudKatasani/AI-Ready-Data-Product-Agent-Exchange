-- Statements with payments received within 60 days of the statement date.
CREATE OR REPLACE TABLE CONFORMED_GOLD.FCT_BILLING AS
WITH paid AS (
  SELECT p.statement_id, sum(p.amount) AS paid_60d, min(date_diff('day', s.statement_date, p.payment_date)) AS days_to_pay
  FROM CURATED_SILVER.PAYMENT p
  JOIN CURATED_SILVER.BILLING_STATEMENT s ON s.statement_id = p.statement_id
  WHERE p.payment_date <= s.statement_date + INTERVAL 60 DAY
  GROUP BY p.statement_id
)
SELECT row_number() OVER (ORDER BY s.statement_id) AS statement_key, s.statement_id, c.customer_key,
       CAST(strftime(s.statement_date, '%Y%m%d') AS INTEGER) AS date_key, s.statement_date, s.due_date,
       s.billed_amount, s.arrears_amount, s.estimated_flag AS estimated,
       s.statement_date <= GOVERNANCE.as_of() - INTERVAL 60 DAY AS mature,
       round(least(coalesce(pd.paid_60d, 0), s.billed_amount), 2) AS paid_within_60d_amount,
       pd.days_to_pay
FROM CURATED_SILVER.BILLING_STATEMENT s
JOIN CONFORMED_GOLD.DIM_CUSTOMER c ON c.customer_no = s.customer_no
LEFT JOIN paid pd ON pd.statement_id = s.statement_id;
