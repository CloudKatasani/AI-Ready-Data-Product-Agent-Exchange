CREATE OR REPLACE TABLE CURATED_SILVER.GRANT_AWARD AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.GRT_AWARD
  QUALIFY row_number() OVER (PARTITION BY grant_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT grant_id, CURATED_SILVER.canon(funder, ['Federal', 'State', 'Foundation']) AS funder,
       CURATED_SILVER.canon(program_area, ['Human services', 'Transportation', 'Public safety', 'Housing', 'Parks & environment', 'Workforce development']) AS program_area,
       CURATED_SILVER.canon(department, ['Eligibility Services', 'Case Management', 'Public Works', 'Community Development', 'Parks & Facilities', 'County Administration']) AS department,
       award_amount, start_date, CAST(start_date + to_days(term_days) AS DATE) AS end_date, term_days, draw_pace,
       _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
