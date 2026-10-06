-- Posted journal lines: CDC duplicates and tombstones removed, account types and cost centers conformed.
CREATE OR REPLACE TABLE CURATED_SILVER.GL_JOURNAL_LINE AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.ERP_GL_JOURNAL
  QUALIFY row_number() OVER (PARTITION BY journal_line_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT journal_line_id, entity_id, posting_date,
       CURATED_SILVER.canon(account_type, ['Revenue', 'COGS', 'Opex']) AS account_type,
       CURATED_SILVER.canon(cost_center, ['Sales', 'Marketing', 'Operations', 'Engineering', 'Finance & Admin']) AS cost_center,
       intercompany_flag, amount_usd, trim(memo) AS memo, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
