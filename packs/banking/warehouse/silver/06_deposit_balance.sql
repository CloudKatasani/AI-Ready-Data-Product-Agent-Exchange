-- Account-month ledger balances: month number decoded to the month-end date; monthly interest expense derived.
CREATE OR REPLACE TABLE CURATED_SILVER.DEPOSIT_BALANCE AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.CORE_DEPOSIT_BALANCE
  QUALIFY row_number() OVER (PARTITION BY balance_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT balance_id, account_id, customer_id, branch_id,
       CURATED_SILVER.canon(segment, ['Mass market', 'Mass affluent', 'Private client', 'Small business']) AS segment,
       CURATED_SILVER.canon(deposit_product, ['Checking', 'Savings', 'Money market', 'Time deposit']) AS deposit_product,
       CAST(last_day(DATE '2025-01-01' + to_months(month_no - 1)) AS DATE) AS month_end,
       ledger_balance, interest_rate_pct, round(ledger_balance * interest_rate_pct / 100.0 / 12.0, 2) AS interest_expense,
       _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
