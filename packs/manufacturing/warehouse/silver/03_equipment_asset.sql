CREATE OR REPLACE TABLE CURATED_SILVER.EQUIPMENT_ASSET AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.EAM_ASSET
  QUALIFY row_number() OVER (PARTITION BY asset_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT asset_id, line_id, CURATED_SILVER.bu(business_unit) AS business_unit,
       CURATED_SILVER.canon(asset_type, ['CNC machine', 'Robot cell', 'Press', 'Conveyor', 'Test rig', 'Furnace', 'Coating booth']) AS asset_type,
       upper(trim(criticality)) AS criticality, install_year, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
