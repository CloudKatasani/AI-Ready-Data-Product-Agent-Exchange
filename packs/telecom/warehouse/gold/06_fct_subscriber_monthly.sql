-- One row per sampled line-month. Opening base = every line that started the month (not a gross add).
-- Churn = voluntary disconnects + port-outs; involuntary disconnects and plan migrations are not churn.
CREATE OR REPLACE TABLE CONFORMED_GOLD.FCT_SUBSCRIBER_MONTHLY AS
SELECT row_number() OVER (ORDER BY l.line_month_id) AS line_month_key, l.line_month_id, s.subscriber_key, p.plan_key, m.market_key,
       CAST(strftime(l.month_end, '%Y%m%d') AS INTEGER) AS date_key, l.month_end, l.segment, l.movement,
       l.movement <> 'Gross add' AS opening_base,
       l.movement IN ('Voluntary disconnect', 'Port-out') AS churned,
       l.movement = 'Voluntary disconnect' AS voluntary_disconnect, l.movement = 'Port-out' AS port_out,
       l.movement = 'Involuntary disconnect' AS involuntary_disconnect, l.movement = 'Gross add' AS gross_add,
       l.movement = 'Plan migration' AS plan_migration,
       CASE WHEN l.movement = 'Gross add' THEN 1 WHEN l.movement IN ('Voluntary disconnect', 'Port-out', 'Involuntary disconnect') THEN -1 ELSE 0 END AS net_add_delta,
       l.prepaid_inactive, l.save_offer_made, l.save_offer_accepted
FROM CURATED_SILVER.LINE_MONTH l
JOIN CONFORMED_GOLD.DIM_SUBSCRIBER s ON s.subscriber_id = l.subscriber_id
JOIN CONFORMED_GOLD.DIM_PLAN p ON p.plan_id = l.plan_id
JOIN CONFORMED_GOLD.DIM_MARKET m ON m.market_id = l.market_id;
