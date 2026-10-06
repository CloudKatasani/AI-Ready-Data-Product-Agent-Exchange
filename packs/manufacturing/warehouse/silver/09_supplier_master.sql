CREATE OR REPLACE TABLE CURATED_SILVER.SUPPLIER_MASTER AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.SRM_SUPPLIER
  QUALIFY row_number() OVER (PARTITION BY supplier_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT supplier_id, CURATED_SILVER.proper(supplier_name) AS supplier_name,
       CURATED_SILVER.canon(category, ['Castings & forgings', 'Bearings', 'Electronic components', 'Seals & gaskets', 'Fasteners', 'Aerospace alloys',
                                       'Hydraulic fittings', 'Shafts & gears', 'Bar & plate', 'Printed circuit boards']) AS category,
       country, preferred_flag, tax_id, lower(contact_email) AS contact_email, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
