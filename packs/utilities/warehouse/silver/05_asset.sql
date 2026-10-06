CREATE OR REPLACE TABLE CURATED_SILVER.ASSET AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.EAM_ASSET
  QUALIFY row_number() OVER (PARTITION BY asset_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT asset_id, feeder_id,
       CURATED_SILVER.canon(asset_class, ['Transformer', 'Pole', 'Switch', 'Recloser', 'Regulator', 'Capacitor']) AS asset_class,
       CURATED_SILVER.proper(manufacturer) AS manufacturer, install_year, health_score,
       CURATED_SILVER.canon(criticality, ['High', 'Medium', 'Low']) AS criticality, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
