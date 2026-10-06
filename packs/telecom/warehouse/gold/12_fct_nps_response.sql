CREATE OR REPLACE TABLE CONFORMED_GOLD.FCT_NPS_RESPONSE AS
SELECT row_number() OVER (ORDER BY r.response_id) AS response_key, r.response_id, s.subscriber_key, s.market_key, s.plan_key,
       CAST(strftime(r.survey_date, '%Y%m%d') AS INTEGER) AS date_key, r.survey_date, r.touchpoint, r.score, r.nps_category,
       r.nps_category = 'Promoter' AS promoter, r.nps_category = 'Detractor' AS detractor, r.verbatim
FROM CURATED_SILVER.NPS_RESPONSE r
JOIN CONFORMED_GOLD.DIM_SUBSCRIBER s ON s.subscriber_id = r.subscriber_id;
