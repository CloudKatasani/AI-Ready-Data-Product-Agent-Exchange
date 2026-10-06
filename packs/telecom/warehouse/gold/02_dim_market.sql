-- Market dimension with the cell sites and technicians based there.
CREATE OR REPLACE TABLE CONFORMED_GOLD.DIM_MARKET AS
WITH sites AS (SELECT market_id, count(*) AS site_count FROM CURATED_SILVER.CELL_SITE GROUP BY market_id),
     techs AS (SELECT market_id, count(*) AS technician_count FROM CURATED_SILVER.TECHNICIAN GROUP BY market_id)
SELECT row_number() OVER (ORDER BY m.market_id) AS market_key, m.market_id, m.market_name, m.region, m.launch_year,
       coalesce(s.site_count, 0) AS site_count, coalesce(t.technician_count, 0) AS technician_count
FROM CURATED_SILVER.MARKET m
LEFT JOIN sites s ON s.market_id = m.market_id
LEFT JOIN techs t ON t.market_id = m.market_id;
