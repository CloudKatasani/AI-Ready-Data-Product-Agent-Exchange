-- Approved budget lines, one row per budget line (budget month truncated to the first of the month).
CREATE OR REPLACE TABLE CURATED_SILVER.BUDGET_LINE AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.FPA_BUDGET
  QUALIFY row_number() OVER (PARTITION BY budget_line_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT budget_line_id, entity_id, CAST(date_trunc('month', budget_month) AS DATE) AS budget_month,
       CURATED_SILVER.canon(account_type, ['Revenue', 'COGS', 'Opex']) AS account_type,
       CURATED_SILVER.canon(cost_center, ['Sales', 'Marketing', 'Operations', 'Engineering', 'Finance & Admin']) AS cost_center,
       budget_usd, plan_version, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
