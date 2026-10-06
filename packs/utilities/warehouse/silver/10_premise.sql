CREATE OR REPLACE TABLE CURATED_SILVER.PREMISE AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.CIS_PREMISE
  QUALIFY row_number() OVER (PARTITION BY premise_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT premise_id, customer_no, meter_id, feeder_id,
       CURATED_SILVER.canon(premise_type, ['Single family', 'Multi family', 'Commercial', 'Industrial']) AS premise_type,
       CURATED_SILVER.canon(city, ['Ridgeport', 'Lakeport', 'Ashbury', 'Brayton', 'Cedar Falls', 'Millbrook', 'Harlow', 'Westvale']) AS city,
       ami_enabled, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
