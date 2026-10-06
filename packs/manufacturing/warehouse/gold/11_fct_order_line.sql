-- Distributor order lines with product family, business unit and distributor attributes (incl. the order-desk
-- contact, which is PII). The date is the proof-of-delivery date, or the promise date while a line is open.
CREATE OR REPLACE TABLE CONFORMED_GOLD.FCT_ORDER_LINE AS
SELECT row_number() OVER (ORDER BY o.order_line_id) AS order_line_key, o.order_line_id,
       CAST(strftime(coalesce(o.delivered_date, o.promised_date), '%Y%m%d') AS INTEGER) AS date_key,
       o.order_date, o.promised_date, o.delivered_date, o.delivered,
       o.delivered AND o.delivered_date <= o.promised_date AS on_time,
       o.delivered AND o.qty_shipped >= o.qty_ordered AS in_full,
       CASE WHEN o.delivered THEN date_diff('day', o.order_date, o.delivered_date) END AS lead_time_days,
       o.qty_ordered, o.qty_shipped, o.net_value_usd, o.std_unit_cost_usd,
       f.family_name AS product_family, o.business_unit,
       d.distributor_id, d.distributor_name, d.sales_region, d.tier AS distributor_tier,
       d.contact_email, d.contact_phone
FROM CURATED_SILVER.SALES_ORDER_LINE o
JOIN CURATED_SILVER.PRODUCT_FAMILY f ON f.family_id = o.family_id
JOIN CURATED_SILVER.DISTRIBUTOR_MASTER d ON d.distributor_id = o.distributor_id;
