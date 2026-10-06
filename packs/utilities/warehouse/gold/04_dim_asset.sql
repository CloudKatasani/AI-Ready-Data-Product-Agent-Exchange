CREATE OR REPLACE TABLE CONFORMED_GOLD.DIM_ASSET AS
SELECT row_number() OVER (ORDER BY a.asset_id) AS asset_key, a.asset_id, f.feeder_key, a.feeder_id, a.asset_class, a.manufacturer,
       a.install_year,
       CASE WHEN a.install_year < 1980 THEN 'Pre-1980' WHEN a.install_year < 2000 THEN '1980-1999' ELSE '2000+' END AS vintage_band,
       a.health_score,
       CASE WHEN a.health_score < 40 THEN 'Poor' WHEN a.health_score < 70 THEN 'Fair' ELSE 'Good' END AS condition_band,
       a.criticality
FROM CURATED_SILVER.ASSET a
LEFT JOIN CONFORMED_GOLD.DIM_FEEDER f ON f.feeder_id = a.feeder_id;
