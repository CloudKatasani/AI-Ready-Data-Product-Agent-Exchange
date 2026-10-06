-- Budget, actual expenditure and positions by department and fiscal month.
CREATE OR REPLACE TABLE CONFORMED_GOLD.FCT_BUDGET AS
SELECT row_number() OVER (ORDER BY period_month, department) AS budget_key,
       CAST(strftime(period_month, '%Y%m%d') AS INTEGER) AS date_key, period_month, department, is_administrative,
       budget_amount, actual_amount, fte_authorized, fte_filled
FROM CURATED_SILVER.GL_BUDGET_LINE;
