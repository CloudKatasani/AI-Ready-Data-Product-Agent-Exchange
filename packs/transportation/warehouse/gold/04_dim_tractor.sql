-- Tractor dimension with home terminal and model-year band.
CREATE OR REPLACE TABLE CONFORMED_GOLD.DIM_TRACTOR AS
SELECT row_number() OVER (ORDER BY tr.tractor_id) AS tractor_key, tr.tractor_id, t.terminal_key, tr.equipment_type, tr.make,
       tr.model_year,
       CASE WHEN tr.model_year >= 2024 THEN '2024 and newer' WHEN tr.model_year >= 2021 THEN '2021 to 2023' ELSE '2020 and older' END AS model_year_band,
       tr.rated_mpg
FROM CURATED_SILVER.TRACTOR tr
JOIN CONFORMED_GOLD.DIM_TERMINAL t ON t.terminal_id = tr.home_terminal_id;
