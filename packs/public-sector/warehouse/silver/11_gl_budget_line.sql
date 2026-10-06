-- Budget and actuals by department and month; period index converted to the fiscal month start.
CREATE OR REPLACE TABLE CURATED_SILVER.GL_BUDGET_LINE AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.FIN_GL_LINE
  QUALIFY row_number() OVER (PARTITION BY line_no ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT line_no, department, period_idx, CAST(DATE '2025-01-01' + to_months(period_idx) AS DATE) AS period_month,
       is_administrative, budget_amount, actual_amount, fte_authorized, fte_filled, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
