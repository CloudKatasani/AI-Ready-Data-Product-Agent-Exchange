-- Shipped lots tracked for warranty claims; `mature` marks lots shipped more than 90 days before the reporting
-- date, so their early-life claim window is complete (BR-MFG-021).
CREATE OR REPLACE TABLE CONFORMED_GOLD.FCT_WARRANTY_LOT AS
SELECT row_number() OVER (ORDER BY w.lot_id) AS warranty_lot_key, w.lot_id,
       CAST(strftime(w.ship_date, '%Y%m%d') AS INTEGER) AS date_key, w.ship_date, f.family_name AS product_family,
       w.business_unit, w.units_shipped, w.claims, w.claim_cost_usd, w.top_failure_mode,
       w.ship_date <= GOVERNANCE.as_of() - INTERVAL 90 DAY AS mature
FROM CURATED_SILVER.WARRANTY_LOT w
JOIN CURATED_SILVER.PRODUCT_FAMILY f ON f.family_id = w.family_id;
