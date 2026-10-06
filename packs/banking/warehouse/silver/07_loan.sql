CREATE OR REPLACE TABLE CURATED_SILVER.LOAN AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.LOS_LOAN
  QUALIFY row_number() OVER (PARTITION BY loan_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT loan_id, customer_id, branch_id,
       CURATED_SILVER.canon(loan_segment, ['Residential mortgage', 'Home equity', 'Auto', 'Personal', 'Commercial real estate', 'Commercial & industrial']) AS loan_segment,
       orig_amount, note_rate_pct, fico_score, ltv_pct, held_for_sale, orig_date, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
