-- Terminal master: deduplicated CDC, region and terminal type conformed.
CREATE OR REPLACE TABLE CURATED_SILVER.TERMINAL AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.TMS_TERMINAL
  QUALIFY row_number() OVER (PARTITION BY terminal_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT terminal_id, trim(terminal_name) AS terminal_name,
       CURATED_SILVER.canon(region, ['Northeast', 'Southeast', 'Central', 'Mountain', 'West']) AS region,
       CURATED_SILVER.canon(terminal_type, ['Terminal', 'Cross-dock', 'Drop yard']) AS terminal_type,
       door_count, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
