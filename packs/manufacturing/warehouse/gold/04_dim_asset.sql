CREATE OR REPLACE TABLE CONFORMED_GOLD.DIM_ASSET AS
SELECT row_number() OVER (ORDER BY a.asset_id) AS asset_key, a.asset_id, a.asset_type, a.criticality,
       CASE a.criticality WHEN 'A' THEN 'A — critical' WHEN 'B' THEN 'B — important' ELSE 'C — standard' END AS criticality_label,
       a.install_year, l.line_key, a.line_id, l.plant_name, a.business_unit
FROM CURATED_SILVER.EQUIPMENT_ASSET a
JOIN CONFORMED_GOLD.DIM_LINE l ON l.line_id = a.line_id;
