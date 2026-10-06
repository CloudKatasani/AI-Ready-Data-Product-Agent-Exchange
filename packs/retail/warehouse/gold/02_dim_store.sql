-- Store dimension with comparable-store status: open at least 13 months at the reporting date and not under remodel.
CREATE OR REPLACE TABLE CONFORMED_GOLD.DIM_STORE AS
SELECT row_number() OVER (ORDER BY s.store_id) AS store_key, s.store_id, s.store_name, s.region, s.store_format,
       s.open_date, s.under_remodel, s.selling_sq_ft,
       date_diff('month', s.open_date, GOVERNANCE.as_of()) AS months_open,
       s.open_date <= GOVERNANCE.as_of() - INTERVAL 13 MONTH AND NOT s.under_remodel AS comp_store,
       CASE WHEN s.open_date <= GOVERNANCE.as_of() - INTERVAL 13 MONTH AND NOT s.under_remodel THEN 'Comparable' ELSE 'Non-comparable' END AS comp_status
FROM CURATED_SILVER.STORE_LOCATION s;
