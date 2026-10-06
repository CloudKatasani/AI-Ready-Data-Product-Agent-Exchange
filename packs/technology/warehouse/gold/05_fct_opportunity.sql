-- One row per opportunity, keyed to its close date; sales cycle measured on won deals.
CREATE OR REPLACE TABLE CONFORMED_GOLD.FCT_OPPORTUNITY AS
SELECT row_number() OVER (ORDER BY o.opportunity_id) AS opportunity_key, o.opportunity_id, a.account_key,
       CAST(strftime(o.close_date, '%Y%m%d') AS INTEGER) AS date_key, o.created_date, o.close_date,
       o.opp_type, o.lead_source, o.stage, o.is_closed, o.is_won, o.amount_usd,
       CASE WHEN o.is_won THEN date_diff('day', o.created_date, o.close_date) END AS cycle_days,
       r.rep_name AS sales_rep, r.sales_team
FROM CURATED_SILVER.SALES_OPPORTUNITY o
JOIN CONFORMED_GOLD.DIM_ACCOUNT a ON a.account_id = o.account_id
LEFT JOIN CURATED_SILVER.SALES_REP r ON r.rep_id = o.rep_id;
