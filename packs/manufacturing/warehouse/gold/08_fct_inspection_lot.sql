CREATE OR REPLACE TABLE CONFORMED_GOLD.FCT_INSPECTION_LOT AS
SELECT row_number() OVER (ORDER BY q.lot_id) AS lot_key, q.lot_id, l.line_key,
       CAST(strftime(q.inspection_date, '%Y%m%d') AS INTEGER) AS date_key, q.inspection_date, q.lot_type,
       q.inspected_qty, q.defect_qty, q.passed_first, q.defect_code, q.disposition, q.ncr_number,
       q.ncr_number IS NOT NULL AS ncr_raised, q.copq_usd
FROM CURATED_SILVER.INSPECTION_LOT q
JOIN CONFORMED_GOLD.DIM_LINE l ON l.line_id = q.line_id;
