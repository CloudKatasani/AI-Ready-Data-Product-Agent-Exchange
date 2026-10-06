CREATE OR REPLACE TABLE CONFORMED_GOLD.DIM_LINE AS
SELECT row_number() OVER (ORDER BY line_code) AS line_key, line_code, line_name AS line_of_business, segment, statement_line,
       plan_loss_ratio_pct, plan_expense_ratio_pct
FROM CURATED_SILVER.LINE_OF_BUSINESS;
