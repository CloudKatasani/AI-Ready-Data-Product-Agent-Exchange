-- Production lines with their plant, business unit, nameplate ideal cycle time and controlled process recipe.
CREATE OR REPLACE TABLE CONFORMED_GOLD.DIM_LINE AS
SELECT row_number() OVER (ORDER BY l.line_id) AS line_key, l.line_id, l.line_type, l.line_status, l.shift_pattern,
       p.plant_key, l.plant_id, p.plant_name, p.country, l.business_unit, p.emission_factor,
       l.ideal_cycle_sec, l.kw_run, l.process_recipe_id
FROM CURATED_SILVER.PRODUCTION_LINE l
JOIN CONFORMED_GOLD.DIM_PLANT p ON p.plant_id = l.plant_id;
