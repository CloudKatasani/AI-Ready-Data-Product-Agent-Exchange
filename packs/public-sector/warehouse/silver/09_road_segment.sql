CREATE OR REPLACE TABLE CURATED_SILVER.ROAD_SEGMENT AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.PW_ROAD_SEGMENT
  QUALIFY row_number() OVER (PARTITION BY segment_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT segment_id, CURATED_SILVER.canon(region, ['North', 'Central', 'South', 'Riverside']) AS region,
       CURATED_SILVER.canon(functional_class, ['Arterial', 'Collector', 'Local']) AS functional_class,
       lane_miles, least(greatest(pci, 0), 100) AS pci, last_paved_year, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
