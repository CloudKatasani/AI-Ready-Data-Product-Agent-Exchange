CREATE OR REPLACE TABLE CURATED_SILVER.MATERIAL_MASTER AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.ERP_MATERIAL
  QUALIFY row_number() OVER (PARTITION BY material_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT material_id,
       CURATED_SILVER.canon(material_class, ['Raw material', 'Purchased component', 'Work in progress', 'Finished goods', 'MRO spare']) AS material_class,
       CURATED_SILVER.canon(material_status, ['Active', 'Obsolete']) AS material_status, upper(trim(abc_class)) AS abc_class,
       unit_cost_usd, safety_stock_days, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
