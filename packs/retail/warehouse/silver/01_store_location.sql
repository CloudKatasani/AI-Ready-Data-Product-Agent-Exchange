-- Store master: deduplicated CDC, region and format conformed.
CREATE OR REPLACE TABLE CURATED_SILVER.STORE_LOCATION AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.MDM_STORE
  QUALIFY row_number() OVER (PARTITION BY store_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT store_id, trim(store_name) AS store_name, CURATED_SILVER.canon(region, ['Northeast', 'Southeast', 'Midwest', 'Southwest', 'Pacific']) AS region,
       CURATED_SILVER.canon(store_format, ['Flagship', 'Standard', 'Neighborhood', 'Outlet']) AS store_format,
       open_date, under_remodel, selling_sq_ft, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
