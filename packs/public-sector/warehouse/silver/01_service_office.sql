-- Human services offices: two per service district, with filled caseworker positions.
CREATE OR REPLACE TABLE CURATED_SILVER.SERVICE_OFFICE AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.CM_OFFICE
  QUALIFY row_number() OVER (PARTITION BY office_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT office_id, trim(office_name) AS office_name, trim(city) AS city,
       CURATED_SILVER.canon(region, ['North', 'Central', 'South', 'Riverside']) AS region,
       caseworkers, residents_served, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
