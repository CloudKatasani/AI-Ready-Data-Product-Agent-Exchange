-- One row per sampled account-month; balance above the $250,000 insured limit counts as uninsured.
CREATE OR REPLACE TABLE CONFORMED_GOLD.FCT_DEPOSIT_BALANCE AS
SELECT row_number() OVER (ORDER BY d.balance_id) AS deposit_balance_key, d.balance_id, d.account_id, c.customer_key, b.branch_key,
       CAST(strftime(d.month_end, '%Y%m%d') AS INTEGER) AS date_key, d.month_end, d.deposit_product,
       CASE WHEN d.deposit_product = 'Checking' THEN 'Non-interest-bearing' ELSE 'Interest-bearing' END AS deposit_type,
       c.segment, d.ledger_balance, d.interest_rate_pct, d.interest_expense,
       round(greatest(d.ledger_balance - 250000, 0), 2) AS uninsured_balance
FROM CURATED_SILVER.DEPOSIT_BALANCE d
JOIN CONFORMED_GOLD.DIM_CUSTOMER c ON c.customer_id = d.customer_id
JOIN CONFORMED_GOLD.DIM_BRANCH b ON b.branch_id = d.branch_id;
