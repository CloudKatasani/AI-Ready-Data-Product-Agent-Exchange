-- Inspection lots: deduplicated, lot type and defect codes conformed; a lot passes first inspection only with no
-- defects (concessions count as failures, BR-MFG-007). Failed lots carry the NCR, usage decision and COPQ.
CREATE OR REPLACE TABLE CURATED_SILVER.INSPECTION_LOT AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.QMS_INSPECTION_LOT
  QUALIFY row_number() OVER (PARTITION BY lot_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
)
SELECT lot_id, line_id, plant_id, CURATED_SILVER.bu(business_unit) AS business_unit, inspection_date,
       CURATED_SILVER.canon(lot_type, ['Production', 'Trial']) AS lot_type, inspected_qty, least(defect_qty, inspected_qty) AS defect_qty,
       defect_qty = 0 AS passed_first,
       CASE WHEN defect_qty > 0 THEN CURATED_SILVER.canon(defect_code, ['Dimensional out of tolerance', 'Surface finish', 'Porosity', 'Leak test failure',
                                                                        'Solder bridge', 'Wrong component', 'Burr or sharp edge', 'Torque out of spec']) END AS defect_code,
       CASE WHEN defect_qty = 0 THEN 'Accept' WHEN usage_decision = 'R' THEN 'Rework' WHEN usage_decision = 'S' THEN 'Scrap' ELSE 'Use as is' END AS disposition,
       CASE WHEN defect_qty > 0 THEN ncr_no END AS ncr_number,
       CASE WHEN defect_qty > 0 THEN copq_estimate_usd ELSE 0 END AS copq_usd, _loaded_at AS loaded_at
FROM latest WHERE _op <> 'D';
