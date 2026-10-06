-- The catastrophe code list: any claim carrying one of these codes is a catastrophe claim.
CREATE OR REPLACE TABLE CURATED_SILVER.CAT_EVENT AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.CAT_EVENT
  QUALIFY row_number() OVER (PARTITION BY event_code ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT event_code, trim(event_name) AS event_name, trim(peril) AS peril, trim(region) AS footprint,
       CAST(start_date AS DATE) AS start_date, CAST(end_date AS DATE) AS end_date, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
