-- One row per posted journal line (Actual) or budget line (Budget), so actuals and plan share one grain.
CREATE OR REPLACE TABLE CONFORMED_GOLD.FCT_FINANCIALS AS
WITH lines AS (
  SELECT journal_line_id AS line_id, entity_id, posting_date, 'Actual' AS scenario, account_type, cost_center,
         intercompany_flag AS is_intercompany, amount_usd AS actual_usd, 0.0 AS budget_usd
  FROM CURATED_SILVER.GL_JOURNAL_LINE
  UNION ALL
  SELECT budget_line_id, entity_id, budget_month, 'Budget', account_type, cost_center, FALSE, 0.0, budget_usd
  FROM CURATED_SILVER.BUDGET_LINE
)
SELECT row_number() OVER (ORDER BY l.line_id) AS line_key, l.line_id, le.entity_key,
       CAST(strftime(l.posting_date, '%Y%m%d') AS INTEGER) AS date_key, l.posting_date, l.scenario,
       l.account_type, CASE l.account_type WHEN 'COGS' THEN 'Cost of sales' WHEN 'Opex' THEN 'Operating expense' ELSE 'Revenue' END AS account_label,
       l.cost_center, l.is_intercompany, round(l.actual_usd, 2) AS actual_usd, round(l.budget_usd, 2) AS budget_usd
FROM lines l
JOIN CONFORMED_GOLD.DIM_LEGAL_ENTITY le ON le.entity_id = l.entity_id;
