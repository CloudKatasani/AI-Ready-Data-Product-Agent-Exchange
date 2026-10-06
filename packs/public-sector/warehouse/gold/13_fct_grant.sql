-- One row per grant award with drawdown to date against the elapsed award period.
CREATE OR REPLACE TABLE CONFORMED_GOLD.FCT_GRANT AS
WITH g AS (
  SELECT *, least(greatest(date_diff('day', start_date, GOVERNANCE.as_of()) / term_days, 0.0), 1.0) AS elapsed_share
  FROM CURATED_SILVER.GRANT_AWARD
)
SELECT row_number() OVER (ORDER BY grant_id) AS grant_key, grant_id, funder, program_area, department,
       award_amount, start_date, end_date, CASE WHEN end_date < GOVERNANCE.as_of() THEN 'Closed' ELSE 'Active' END AS grant_status,
       round(elapsed_share, 3) AS elapsed_share,
       round(award_amount * least(elapsed_share * draw_pace, 1.0), 0) AS drawn_amount,
       round(100 * least(elapsed_share * draw_pace, 1.0), 1) AS drawdown_pct,
       end_date >= GOVERNANCE.as_of() AND least(elapsed_share * draw_pace, 1.0) < elapsed_share - 0.2 AS at_risk
FROM g;
