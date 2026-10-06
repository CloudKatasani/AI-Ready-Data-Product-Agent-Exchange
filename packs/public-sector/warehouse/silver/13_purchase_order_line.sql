-- Requisition lines: PO date derived from cycle days; requisitions without a PO by the reporting date are open.
CREATE OR REPLACE TABLE CURATED_SILVER.PURCHASE_ORDER_LINE AS
WITH latest AS (
  SELECT * FROM RAW_BRONZE.FIN_PO_LINE
  QUALIFY row_number() OVER (PARTITION BY po_line_id ORDER BY _loaded_at DESC, CURATED_SILVER.op_rank(_op) DESC) = 1
), typed AS (
  SELECT po_line_id, vendor_id,
         CURATED_SILVER.canon(category, ['Construction services', 'Road materials', 'Fleet & equipment', 'IT & software', 'Professional services', 'Facilities maintenance', 'Social services providers', 'Office supplies']) AS category,
         CURATED_SILVER.canon(department, ['Eligibility Services', 'Case Management', 'Public Works', 'Community Development', '311 Contact Center', 'Parks & Facilities', 'Solid Waste', 'Information Technology', 'Water Utility']) AS department,
         requisition_date,
         CURATED_SILVER.canon(procurement_method, ['Cooperative contract', 'Competitive bid', 'Informal quote', 'Sole source', 'Emergency']) AS procurement_method,
         cycle_days, spend_usd, on_contract, CURATED_SILVER.proper(buyer) AS buyer,
         CAST(requisition_date + to_days(cycle_days) AS DATE) AS ordered_on, _loaded_at
  FROM latest WHERE _op <> 'D'
)
SELECT po_line_id, vendor_id, category, department, requisition_date, procurement_method,
       CASE WHEN ordered_on <= GOVERNANCE.as_of() THEN ordered_on END AS po_date,
       CASE WHEN ordered_on <= GOVERNANCE.as_of() THEN cycle_days END AS cycle_days,
       spend_usd, on_contract, buyer, _loaded_at AS loaded_at
FROM typed;
