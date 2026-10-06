CREATE OR REPLACE TABLE CONFORMED_GOLD.DIM_CELL_SITE AS
SELECT row_number() OVER (ORDER BY c.site_id) AS site_key, c.site_id, concat(m.market_name, ' ', c.site_id) AS site_name,
       m.market_key, m.market_name, m.region, c.technology, c.site_type, c.site_class, c.vendor, c.subscribers_served, c.on_air_year
FROM CURATED_SILVER.CELL_SITE c
JOIN CONFORMED_GOLD.DIM_MARKET m ON m.market_id = c.market_id;
