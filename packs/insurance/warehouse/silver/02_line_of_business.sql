-- Product catalogue: one row per line of business with its statutory statement line and plan ratios.
CREATE OR REPLACE TABLE CURATED_SILVER.LINE_OF_BUSINESS AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.PAS_LINE_OF_BUSINESS
  QUALIFY row_number() OVER (PARTITION BY line_code ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT line_code, trim(line_name) AS line_name, trim(segment) AS segment, trim(statement_line) AS statement_line,
       plan_loss_ratio_pct, plan_expense_ratio_pct, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
