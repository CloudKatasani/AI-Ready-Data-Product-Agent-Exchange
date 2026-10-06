CREATE OR REPLACE TABLE CURATED_SILVER.WARRANTY_LOT AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.SVC_WARRANTY_LOT
  QUALIFY row_number() OVER (PARTITION BY lot_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT lot_id, family_id, CURATED_SILVER.bu(business_unit) AS business_unit, ship_date, units_shipped, claims, claim_cost_usd,
       CURATED_SILVER.canon(top_failure_mode, ['Seal leak', 'Bearing wear', 'Electrical fault', 'Firmware fault', 'Corrosion', 'Fastener loosening']) AS top_failure_mode,
       _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
