CREATE OR REPLACE TABLE CONFORMED_GOLD.DIM_TERMINAL AS
SELECT row_number() OVER (ORDER BY terminal_id) AS terminal_key, terminal_id, terminal_name, region, terminal_type, door_count
FROM CURATED_SILVER.TERMINAL;
