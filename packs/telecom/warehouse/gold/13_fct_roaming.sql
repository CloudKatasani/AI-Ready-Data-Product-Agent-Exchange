-- One row per roaming record: retail outbound (Altair subscribers abroad, home market) or wholesale inbound
-- (partner subscribers carried in the market).
CREATE OR REPLACE TABLE CONFORMED_GOLD.FCT_ROAMING AS
SELECT row_number() OVER (ORDER BY r.record_id) AS roaming_key, r.record_id, m.market_key,
       CAST(strftime(r.event_date, '%Y%m%d') AS INTEGER) AS date_key, r.event_date, r.direction, r.partner_zone,
       r.partner_network, r.data_mb, r.revenue_amount
FROM CURATED_SILVER.ROAMING_RECORD r
JOIN CONFORMED_GOLD.DIM_MARKET m ON m.market_id = r.market_id;
